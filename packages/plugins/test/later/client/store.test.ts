import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Message, SavedItem, Ts } from "@slock/types";
import { ch, stamp, uid } from "@slock/slack/testing";
import { createRoot, flush } from "solid-js";
import { createLaterSlice, type LaterApi } from "../../../src/later/client/store";

const C1 = ch("C1");

type Call = [string, ...unknown[]];

function harness(initial: SavedItem[] = []) {
  const calls: Call[] = [];
  const flashes: string[] = [];
  let failing = false;
  let loadFailing = false;
  let server = initial;
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
    fetchSaved: () =>
      loadFailing
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(server.map((item) => ({ ...item }))),
    saveWithReminder: async (...args) => {
      await record("saveWithReminder")(...args);
      return { ok: true };
    },
    toggleSaved: async (...args) => {
      await record("toggleSaved")(...args);
      return { ok: true };
    },
    updateSaved: async (...args) => {
      await record("updateSaved")(...args);
      return { ok: true };
    },
  };
  const later = createLaterSlice(api, (_key, message) => flashes.push(message));
  return {
    calls,
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

const savedMessage = (ts: Ts): Message => ({
  day: "",
  id: ts,
  kind: "normal",
  text: ts,
  time: "",
  ts,
  userId: uid("U1"),
});

const item = (ts: Ts, dateDue?: number): SavedItem => ({ channelId: C1, dateDue, ts });

async function loaded(initial: SavedItem[]) {
  const h = harness(initial);
  await h.later.ensureLaterLoaded();
  return h;
}

const run = <T>(fn: () => Promise<T>) =>
  createRoot(async (dispose) => {
    try {
      return await fn();
    } finally {
      dispose();
    }
  });

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

describe("createLaterSlice", () => {
  test("loads saved items and their messages", async () => {
    await run(async () => {
      const { later } = await loaded([item(stamp("1.1")), item(stamp("2.2"))]);
      expect(later.laterItems.map((i) => i.ts)).toEqual([stamp("1.1"), stamp("2.2")]);
      await Promise.resolve();
      expect(later.laterMessageFor(C1, stamp("1.1"))?.ts).toBe(stamp("1.1"));
    });
  });

  test("toggle saves an unsaved message and unsaves a saved one", async () => {
    await run(async () => {
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
  });

  test("a failed change rolls back and flashes", async () => {
    await run(async () => {
      const h = await loaded([item(stamp("1.1"), 100), item(stamp("2.2"))]);
      h.fail(true);
      expect(await h.later.setReminder(C1, stamp("2.2"), 500)).toBe(false);
      expect(await h.later.toggleSaveForLater(C1, stamp("3.3"))).toBe(false);
      expect(h.later.laterItems.map((i) => [String(i.ts), i.dateDue])).toEqual([
        ["1.1", 100],
        ["2.2", undefined],
      ]);
      expect(h.flashes).toHaveLength(2);
      expect(h.later.isSaveForLaterPending(C1, stamp("2.2"))).toBe(false);
    });
  });

  test("a reminder on an unsaved message saves it with the due date", async () => {
    await run(async () => {
      const { calls, later } = await loaded([]);
      await later.setReminder(C1, stamp("1.1"), 700);
      expect(later.reminderDue(C1, stamp("1.1"))).toBe(700);
      expect(calls).toEqual([["saveWithReminder", C1, stamp("1.1"), 700]]);
    });
  });

  test("a reminder on a saved message updates it and can be cleared", async () => {
    await run(async () => {
      const { calls, later } = await loaded([item(stamp("1.1"))]);
      await later.setReminder(C1, stamp("1.1"), 700);
      await later.clearReminder(C1, stamp("1.1"));
      expect(later.reminderDue(C1, stamp("1.1"))).toBeUndefined();
      expect(calls).toEqual([
        ["updateSaved", C1, stamp("1.1"), { dateDue: 700 }],
        ["updateSaved", C1, stamp("1.1"), { dateDue: 0 }],
      ]);
    });
  });

  test("a second change for the same message is rejected while one is pending", async () => {
    await run(async () => {
      const { calls, later } = await loaded([item(stamp("1.1"))]);
      const first = later.toggleSaveForLater(C1, stamp("1.1"));
      const second = later.toggleSaveForLater(C1, stamp("1.1"));
      expect(await second).toBe(false);
      expect(await first).toBe(true);
      expect(calls).toHaveLength(1);
    });
  });

  test("changes are ignored while the list is loading", async () => {
    await run(async () => {
      const h = harness([item(stamp("1.1"))]);
      const loading = h.later.ensureLaterLoaded();
      expect(await h.later.toggleSaveForLater(C1, stamp("2.2"))).toBe(false);
      await loading;
      expect(h.calls).toHaveLength(0);
    });
  });

  test("realtime events add and remove once and are ignored before the first load", async () => {
    await run(async () => {
      const h = harness([item(stamp("1.1"))]);
      h.later.applySavedEvent("add", C1, stamp("5.5"));
      expect(h.later.laterItems).toHaveLength(0);
      await h.later.ensureLaterLoaded();
      h.later.applySavedEvent("add", C1, stamp("5.5"));
      h.later.applySavedEvent("add", C1, stamp("5.5"));
      flush();
      expect(h.later.laterItems.map((i) => i.ts)).toEqual([stamp("1.1"), stamp("5.5")]);
      h.later.applySavedEvent("remove", C1, stamp("1.1"));
      h.later.applySavedEvent("remove", C1, stamp("9.9"));
      flush();
      expect(h.later.laterItems.map((i) => i.ts)).toEqual([stamp("5.5")]);
      h.later.applySavedEvent("clear");
      flush();
      expect(h.later.laterItems).toHaveLength(0);
    });
  });

  test("a failed load sets the error flag and a retry clears it", async () => {
    await run(async () => {
      const h = harness([item(stamp("1.1"))]);
      h.failLoad(true);
      await h.later.ensureLaterLoaded();
      expect(h.later.laterLoadError()).toBe(true);
      expect(h.later.laterLoaded()).toBe(false);
      expect(h.later.laterLoading()).toBe(false);
      h.failLoad(false);
      await h.later.ensureLaterLoaded();
      expect(h.later.laterLoadError()).toBe(false);
      expect(h.later.laterLoaded()).toBe(true);
      expect(h.later.laterItems).toHaveLength(1);
    });
  });
});
