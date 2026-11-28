import { describe, expect, test } from "bun:test";
import type { UserCustomField, UserProfile } from "@slock/types";
import { flush } from "solid-js";
import { elapse, jsonReply, settle, watch } from "../../../support/queryHost";
import { uid } from "../../../support/slack";
import { ME, offline, startUsers as start, user } from "./startUsers";

describe("user lookups", () => {
  test("a missing user is remembered, then asked about again once that expires", async () => {
    const { calls, env, store } = await start();
    const read = () => store.userById(uid("U2"));
    const first = watch(read);
    await settle();
    first();
    watch(read)();
    await settle();
    expect(store.isUserUnavailable(uid("U2"))).toBe(true);
    expect(calls.fetchUser).toHaveLength(1);
    env.advance(30_000);
    const later = watch(read);
    await settle();
    expect(calls.fetchUser).toHaveLength(2);
    later();
  });

  test("a failed lookup is not remembered as missing and is retried", async () => {
    let down = true;
    const bob = user("U2", "bob");
    const { env, store } = await start({
      fetchUser: () => (down ? Promise.reject(offline()) : Promise.resolve(bob)),
    });
    const stop = watch(() => store.userById(bob.id));
    await elapse(env, 1_000);
    expect(store.isUserUnavailable(bob.id)).toBe(true);
    down = false;
    await elapse(env, 30_000);
    expect(store.isUserUnavailable(bob.id)).toBe(false);
    expect(store.userById(bob.id)?.name).toBe("bob");
    stop();
  });

  test("invalidating a missing user fetches it again", async () => {
    let known = false;
    const bob = user("U2", "bob");
    const { calls, store } = await start({
      fetchUser: () => Promise.resolve(known ? bob : null),
    });
    store.userById(bob.id);
    await settle();
    expect(store.isUserUnavailable(bob.id)).toBe(true);
    known = true;
    store.invalidateUser(bob.id);
    store.userById(bob.id);
    await settle();
    expect(store.userById(bob.id)?.name).toBe("bob");
    expect(calls.fetchUser).toHaveLength(2);
  });
});

describe("presence lookups", () => {
  test("a failed presence lookup is retried", async () => {
    let down = true;
    const { env, store } = await start({
      fetchUserPresence: () => (down ? Promise.reject(offline()) : Promise.resolve("active")),
    });
    const stop = watch(() => store.presenceFor(uid("U2")));
    await elapse(env, 1_000);
    expect(store.presenceFor(uid("U2"))).toBeUndefined();
    down = false;
    await elapse(env, 30_000);
    expect(store.presenceFor(uid("U2"))).toBe("active");
    stop();
  });

  test("hydrating a presence again retries a failure and skips an answer", async () => {
    let down = true;
    const { calls, env, store } = await start({
      fetchUserPresence: () => (down ? Promise.reject(offline()) : Promise.resolve("away")),
    });
    store.loadPresence(uid("U2"));
    await elapse(env, 1_000);
    const failed = calls.fetchUserPresence.length;
    down = false;
    store.loadPresence(uid("U2"));
    await settle();
    store.loadPresence(uid("U2"));
    await settle();
    expect(calls.fetchUserPresence).toHaveLength(failed + 1);
    expect(store.presenceFor(uid("U2"))).toBe("away");
  });

  test("a live presence event beats a lookup still in flight", async () => {
    const answer = Promise.withResolvers<"away">();
    const { store } = await start({ fetchUserPresence: () => answer.promise });
    store.presenceFor(uid("U2"));
    await settle();
    store.setPresenceOverrides(uid("U2"), "active");
    answer.resolve("away");
    await settle();
    expect(store.presenceFor(uid("U2"))).toBe("active");
  });
});

describe("bot bios", () => {
  test("a failed bio lookup is retried", async () => {
    const { env, store } = await start();
    let down = true;
    env.fetch.respond(/\/api\/apps\/A1\/profile/, () =>
      down ? jsonReply({ error: "internal_error" }, 500) : jsonReply({ desc: "Beep" }),
    );
    const stop = watch(() => store.botBio("A1", "B1"));
    await elapse(env, 1_000);
    expect(store.botBio("A1", "B1")).toBeUndefined();
    down = false;
    await elapse(env, 30_000);
    expect(store.botBio("A1", "B1")).toBe("Beep");
    stop();
  });
});

describe("profile fields", () => {
  const field = (id: string, value: string): UserCustomField => ({ id, value });

  test("a failed profile lookup is retried", async () => {
    let down = true;
    const { env, store } = await start({
      fetchUserProfile: () =>
        down ? Promise.reject(offline()) : Promise.resolve({ startDate: "2024-01-02" }),
    });
    const stop = watch(() => store.profileStartDateFor(uid("U2")));
    await elapse(env, 1_000);
    down = false;
    await elapse(env, 30_000);
    expect(store.profileStartDateFor(uid("U2"))).toBe("2024-01-02");
    stop();
  });

  test("saved custom fields merge into the loaded ones", async () => {
    const { store } = await start({
      fetchUserProfile: () =>
        Promise.resolve({ customFields: [field("Xf1", "blue"), field("Xf2", "cat")] }),
    });
    const stop = watch(() => store.customFieldsFor(ME.id));
    await settle();
    await store.updateMyProfile({ customFields: { Xf1: "red", Xf2: "" } });
    flush();
    expect(store.customFieldsFor(ME.id)).toEqual([field("Xf1", "red")]);
    stop();
  });

  test("a save while the profile is loading reloads it and keeps the other fields", async () => {
    const stale = Promise.withResolvers<UserProfile>();
    let saved = false;
    const { store } = await start({
      fetchUserProfile: () =>
        saved
          ? Promise.resolve({ customFields: [field("Xf1", "red"), field("Xf2", "cat")] })
          : stale.promise,
    });
    const stop = watch(() => store.customFieldsFor(ME.id));
    await settle();
    saved = true;
    await store.updateMyProfile({ customFields: { Xf1: "red" } });
    stale.resolve({ customFields: [field("Xf1", "blue")] });
    await settle();
    expect(store.customFieldsFor(ME.id)).toEqual([field("Xf1", "red"), field("Xf2", "cat")]);
    stop();
  });
});
