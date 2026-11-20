import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { inRoot } from "@slock/core/testing";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { Message, SavedItem, Ts } from "@slock/types";
import { flush } from "solid-js";
import { createLaterSlice, type LaterApi } from "../../../src/later/client/store";

const C1 = ch("C1");

type Call = [string, ...unknown[]];

const roots: (() => void)[] = [];

function harness(initial: SavedItem[] = []) {
  const calls: Call[] = [];
  const flashes: string[] = [];
  let failing = false;
  let loadFailing = false;
  let server = initial;
  let fetches = 0;
  const record =
    <A extends unknown[]>(name: string) =>
    (...args: A) => {
      calls.push([name, ...args]);
      return failing ? Promise.reject(new Error("boom")) : Promise.resolve();
    };
  const api: LaterApi = {
    fetchMessagesByIds: (entries) =>
      Promise.resolve(
        new Map(entries.map((entry) => [`${entry.channelId}:${entry.ts}`, savedMessage(entry.ts)])),
      ),
    fetchSaved: () => {
      fetches++;
      return loadFailing
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(server.map((item) => ({ ...item })));
    },
    saveWithReminder: async (channelId, ts, dateDue) => {
      await record("saveWithReminder")(channelId, ts, dateDue);
      server = [...server, { channelId, dateDue, ts }];
      return { ok: true };
    },
    toggleSaved: async (channelId, ts, currentlySaved) => {
      await record("toggleSaved")(channelId, ts, currentlySaved);
      server = currentlySaved
        ? server.filter((entry) => !(entry.channelId === channelId && entry.ts === ts))
        : [...server, { channelId, ts }];
      return { ok: true };
    },
    updateSaved: async (channelId, ts, patch) => {
      await record("updateSaved")(channelId, ts, patch);
      server = server.map((entry) =>
        entry.channelId === channelId && entry.ts === ts
          ? { ...entry, dateDue: patch.dateDue || undefined }
          : entry,
      );
      return { ok: true };
    },
  };
  const root = inRoot(() => createLaterSlice(api, (_key, message) => flashes.push(message)));
  roots.push(root.dispose);
  const later = root.value;
  return {
    calls,
    fetches: () => fetches,
    fail: (value: boolean) => {
      failing = value;
    },
    failLoad: (value: boolean) => {
      loadFailing = value;
    },
    flashes,
    later,
    setServer: (items: SavedItem[]) => {
      server = items;
    },
  };
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  flush();
};

const savedMessage = (ts: string): Message => ({
  day: "",
  id: ts,
  kind: "normal",
  text: ts,
  time: "",
  ts: stamp(ts),
  userId: uid("U1"),
});

const item = (ts: Ts, dateDue?: number): SavedItem => ({ channelId: C1, dateDue, ts });

async function loaded(initial: SavedItem[]) {
  const h = harness(initial);
  await h.later.ensureLaterLoaded();
  return h;
}

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  errors.mockRestore();
  for (const dispose of roots.splice(0)) dispose();
});

describe("createLaterSlice", () => {
  test("loads saved items", async () => {
    const { later } = await loaded([item(stamp("1.1")), item(stamp("2.2"))]);
    expect(later.laterItems().map((i) => i.ts)).toEqual([stamp("1.1"), stamp("2.2")]);
  });

  test("resolves a saved message through the api", async () => {
    const { later } = await loaded([item(stamp("1.1"))]);
    const message = inRoot(() => later.createLaterMessage(() => item(stamp("1.1"))));
    roots.push(message.dispose);
    await settle();
    expect(message.value()?.ts).toBe(stamp("1.1"));
  });

  test("toggle saves an unsaved message and unsaves a saved one", async () => {
    const { calls, later } = await loaded([item(stamp("1.1"))]);
    expect(await later.toggleSaveForLater(C1, stamp("2.2"))).toBe(true);
    expect(later.isSavedForLater(C1, stamp("2.2"))).toBe(true);
    expect(await later.toggleSaveForLater(C1, stamp("1.1"))).toBe(true);
    expect(later.isSavedForLater(C1, stamp("1.1"))).toBe(false);
    expect(calls).toEqual([
      ["toggleSaved", C1, stamp("2.2"), false],
      ["toggleSaved", C1, stamp("1.1"), true],
    ]);
  });

  test("a failed change rolls back and flashes", async () => {
    const h = await loaded([item(stamp("1.1"), 100), item(stamp("2.2"))]);
    h.fail(true);
    expect(await h.later.setReminder(C1, stamp("2.2"), 500)).toBe(false);
    expect(await h.later.toggleSaveForLater(C1, stamp("3.3"))).toBe(false);
    expect(h.later.laterItems().map((i) => [String(i.ts), i.dateDue])).toEqual([
      ["1.1", 100],
      ["2.2", undefined],
    ]);
    expect(h.flashes).toHaveLength(2);
    expect(h.later.isSaveForLaterPending(C1, stamp("2.2"))).toBe(false);
  });

  test("a reminder on an unsaved message saves it with the due date", async () => {
    const { calls, later } = await loaded([]);
    await later.setReminder(C1, stamp("1.1"), 700);
    expect(later.reminderDue(C1, stamp("1.1"))).toBe(700);
    expect(calls).toEqual([["saveWithReminder", C1, stamp("1.1"), 700]]);
  });

  test("a reminder on a saved message updates it and can be cleared", async () => {
    const { calls, later } = await loaded([item(stamp("1.1"))]);
    await later.setReminder(C1, stamp("1.1"), 700);
    await later.clearReminder(C1, stamp("1.1"));
    expect(later.reminderDue(C1, stamp("1.1"))).toBeUndefined();
    expect(calls).toEqual([
      ["updateSaved", C1, stamp("1.1"), { dateDue: 700 }],
      ["updateSaved", C1, stamp("1.1"), { dateDue: 0 }],
    ]);
  });

  test("a second change for the same message is rejected while one is pending", async () => {
    const { calls, later } = await loaded([item(stamp("1.1"))]);
    const first = later.toggleSaveForLater(C1, stamp("1.1"));
    const second = later.toggleSaveForLater(C1, stamp("1.1"));
    expect(await second).toBe(false);
    expect(await first).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test("changes are ignored while the list is loading", async () => {
    const h = harness([item(stamp("1.1"))]);
    const loading = h.later.ensureLaterLoaded();
    expect(await h.later.toggleSaveForLater(C1, stamp("2.2"))).toBe(false);
    await loading;
    expect(h.calls).toHaveLength(0);
  });

  test("reloads on realtime events only after the list was requested", async () => {
    const h = harness([item(stamp("1.1"))]);
    h.later.reloadIfRequested();
    await settle();
    expect(h.fetches()).toBe(0);
    await h.later.ensureLaterLoaded();
    h.setServer([item(stamp("1.1")), item(stamp("5.5"))]);
    h.later.reloadIfRequested();
    await settle();
    expect(h.later.laterItems().map((i) => i.ts)).toEqual([stamp("1.1"), stamp("5.5")]);
    h.setServer([]);
    h.later.reloadIfRequested();
    await settle();
    expect(h.later.laterItems()).toHaveLength(0);
  });

  test("a failed load surfaces as an error and a retry recovers", async () => {
    const h = harness([item(stamp("1.1"))]);
    h.failLoad(true);
    await h.later.ensureLaterLoaded();
    expect(h.later.laterLoadFailed()).toBe(true);
    expect(h.later.laterLoading()).toBe(false);
    h.failLoad(false);
    await h.later.ensureLaterLoaded();
    await settle();
    expect(h.later.laterItems()).toHaveLength(1);
  });
});
