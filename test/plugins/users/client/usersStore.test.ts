import { describe, expect, test } from "bun:test";
import { flush } from "solid-js";
import { settle } from "../../../support/queryHost";
import { uid } from "../../../support/slack";
import { ME, startUsers as start, user } from "./startUsers";

describe("user resolution", () => {
  test("an unknown id is fetched once however often it is read, then resolves", async () => {
    const bob = user("U2", "bob");
    const { calls, store } = await start({ fetchUser: () => Promise.resolve(bob) });
    expect(store.userById(bob.id)).toBeUndefined();
    expect(store.userById(bob.id)).toBeUndefined();
    await settle();
    expect(store.userById(bob.id)?.name).toBe("bob");
    expect(calls.fetchUser).toEqual([bob.id]);
  });

  test("an id that resolves to a different user is an alias of that user", async () => {
    const canonical = user("U9", "new");
    const { store } = await start({ fetchUser: () => Promise.resolve(canonical) });
    store.userById(uid("U2"));
    await settle();
    expect(store.userById(uid("U2"))?.id).toBe(canonical.id);
    expect(store.userIdByName("new")).toBe(canonical.id);
  });

  test("the current user is never fetched and follows the online flag", async () => {
    const { calls, setOnline, store } = await start();
    expect(store.userById(ME.id)?.presence).toBe("active");
    setOnline(false);
    flush();
    expect(store.userById(ME.id)?.presence).toBe("away");
    expect(store.userIdByName("me")).toBe(ME.id);
    expect(calls.fetchUser).toEqual([]);
  });
});

describe("presence", () => {
  test("a peer is asked about once, bots and Slackbot never, and the answer sticks", async () => {
    const { calls, store } = await start({ fetchUserPresence: () => Promise.resolve("away") });
    expect(store.presenceFor(uid("U2"))).toBeUndefined();
    expect(store.presenceFor(uid("U2"))).toBeUndefined();
    expect(store.presenceFor(uid("BBOT"))).toBeUndefined();
    await settle();
    expect(store.presenceFor(uid("U2"))).toBe("away");
    expect(calls.fetchUserPresence).toEqual([uid("U2")]);
  });

  test("a live presence event wins over the earlier answer", async () => {
    const { store } = await start({ fetchUserPresence: () => Promise.resolve("away") });
    store.presenceFor(uid("U2"));
    await settle();
    store.setPresenceOverrides(uid("U2"), "active");
    flush();
    expect(store.presenceFor(uid("U2"))).toBe("active");
  });

  test("going away overrides the online flag and auto removes the override", async () => {
    const { store } = await start();
    expect(await store.updateMyPresence("away")).toBe(true);
    flush();
    expect(store.currentUser()?.presence).toBe("away");
    expect(await store.updateMyPresence("auto")).toBe(true);
    flush();
    expect(store.currentUser()?.presence).toBe("active");
  });

  test("a failed presence write changes nothing and flashes", async () => {
    const { flashes, store } = await start({ setPresence: () => Promise.reject(new Error("no")) });
    expect(await store.updateMyPresence("away")).toBe(false);
    flush();
    expect(store.currentUser()?.presence).toBe("active");
    expect(flashes).toEqual(["Failed to update presence."]);
  });
});

describe("status", () => {
  test("a saved status shows on the current user and clearing it removes it", async () => {
    const { store } = await start();
    await store.updateMyStatus("lunch", "pizza", 0);
    flush();
    expect(store.currentUser()?.statusText).toBe("lunch");
    await store.clearMyStatus();
    flush();
    expect(store.currentUser()?.statusText).toBeUndefined();
    expect(store.currentUser()?.statusEmoji).toBeUndefined();
  });

  test("a failed status write leaves the status alone", async () => {
    const { flashes, store } = await start({ setStatus: () => Promise.reject(new Error("no")) });
    expect(await store.updateMyStatus("lunch", "pizza", 0)).toBe(false);
    flush();
    expect(store.currentUser()?.statusText).toBeUndefined();
    expect(flashes).toEqual(["Failed to update status."]);
  });
});

describe("name lookup", () => {
  test("follows renames and invalidation, and the first user with a name wins", async () => {
    const { store } = await start();
    store.cacheUsers([user("U2", "bob"), user("U3", "dup"), user("U4", "dup")]);
    flush();
    expect(store.userIdByName("bob")).toBe(uid("U2"));
    expect(store.userIdByName("dup")).toBe(uid("U3"));
    store.cacheUsers([user("U2", "robert")]);
    flush();
    expect(store.userIdByName("robert")).toBe(uid("U2"));
    expect(store.userIdByName("bob")).toBeUndefined();
  });

  test("an invalidated user stays shown until the new answer lands", async () => {
    const renamed = user("U2", "robert");
    const { store } = await start({ fetchUser: () => Promise.resolve(renamed) });
    store.cacheUsers([user("U2", "bob")]);
    flush();
    store.invalidateUser(renamed.id);
    expect(store.userById(renamed.id)?.name).toBe("bob");
    await settle();
    expect(store.userIdByName("robert")).toBe(renamed.id);
    expect(store.userIdByName("bob")).toBeUndefined();
  });

  test("a name that matches an object property is not found", async () => {
    const { store } = await start();
    expect(store.userIdByName("constructor")).toBeUndefined();
  });
});

describe("nicknames", () => {
  test("a nickname replaces the shown name and keeps the original, blank removes it", async () => {
    const bob = user("U2", "bob");
    const { store } = await start();
    store.cacheUsers([bob]);
    store.setNickname(bob.id, "  Bobby ");
    flush();
    expect(store.userById(bob.id)).toMatchObject({ name: "Bobby", originalName: "bob" });
    store.setNickname(bob.id, "   ");
    flush();
    expect(store.userById(bob.id)?.name).toBe("bob");
    expect(store.nicknameFor(bob.id)).toBeUndefined();
  });
});

describe("search", () => {
  test("merges local and remote matches without duplicates, honours exclusion and caches remote users", async () => {
    const local = user("U2", "alice");
    const remoteOnly = user("U3", "alicia");
    const { store } = await start({
      searchDirectory: () =>
        Promise.resolve({ truncated: false, users: [local, remoteOnly, user("U4", "alina")] }),
    });
    store.cacheUsers([local, user("U5", "bob")]);
    const found = await store.searchUsers("Ali", uid("U4"));
    expect(found.map((u) => u.id)).toEqual([local.id, remoteOnly.id]);
    expect(store.knownUsers().map((u) => u.id)).toContain(remoteOnly.id);
  });

  test("a blank query never reaches the server", async () => {
    const { store } = await start({
      searchDirectory: () => Promise.reject(new Error("should not be called")),
    });
    expect(await store.searchUsers("   ")).toEqual([]);
  });

  test("a local nickname is searchable", async () => {
    const bob = user("U2", "bob");
    const { store } = await start();
    store.cacheUsers([bob]);
    store.setNickname(bob.id, "Captain");
    flush();
    expect((await store.searchUsers("capt")).map((u) => u.id)).toEqual([bob.id]);
  });
});
