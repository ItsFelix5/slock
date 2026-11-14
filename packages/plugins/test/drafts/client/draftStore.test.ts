import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { forAll, pick, text } from "@slock/core/testing";
import type { Block } from "@slock/types";
import { createEffect, createRoot } from "solid-js";
import {
  applyRemoteDraft,
  channelHasDraft,
  deleteEntry,
  draftCacheKey,
  drafts,
  draftsForChannel,
  draftsReady,
  hydrateDrafts,
  keyToTarget,
  locallyTouchedKeys,
  removeRemoteDraft,
  resetDrafts,
  seedDraft,
  upsertEntry,
} from "../../../src/drafts/client/draftStore";
import { fakeDraftServer } from "./fakeDraftServer";

const blocks = (value: string): Block[] => [
  {
    elements: [{ elements: [{ text: value, type: "text" }], type: "rich_text_section" }],
    type: "rich_text",
  },
];

const entry = (id: string, channelId: string, lastUpdatedTs = "1", threadTs?: string) => ({
  blocks: blocks(id),
  channelId,
  clientMsgId: `cmid-${id}`,
  id,
  lastUpdatedTs,
  threadTs,
});

let server: ReturnType<typeof fakeDraftServer>;

beforeEach(() => {
  resetDrafts();
});

afterEach(() => {
  server?.restore();
  resetDrafts();
});

describe("keys", () => {
  test("channel and thread keys round trip", () => {
    forAll(
      (random) => ({
        channelId: `C${text(random, "ABCDEF0123456789", 8)}`,
        threadTs: pick(random, ["", "1700000000.000100", "1.2"]) || undefined,
      }),
      ({ channelId, threadTs }) => {
        expect(keyToTarget(draftCacheKey(channelId, threadTs))).toEqual(
          threadTs ? { channelId, threadTs } : { channelId },
        );
      },
    );
  });

  test("thread and channel drafts never share a key", () => {
    expect(draftCacheKey("C1")).not.toBe(draftCacheKey("C1", "1.1"));
    expect(draftCacheKey("C1", "1.1")).not.toBe(draftCacheKey("C1", "1.2"));
  });
});

describe("hydrateDrafts", () => {
  test("loads once and groups by channel and thread", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("b", "C1", "1", "9.9"), entry("c", "C2")]);
    expect(await hydrateDrafts()).toBe(true);
    expect(await hydrateDrafts()).toBe(true);
    expect(server.calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(Object.keys(drafts).sort()).toEqual(["C1", "C1:thread:9.9", "C2"]);
    expect(draftsReady()).toBe(true);
  });

  test("dedupes concurrent calls", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    await Promise.all([hydrateDrafts(), hydrateDrafts(), hydrateDrafts()]);
    expect(server.calls.filter((call) => call.method === "GET")).toHaveLength(1);
  });

  test("keeps locally touched keys untouched", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("c", "C2")]);
    locallyTouchedKeys.add("C1");
    await hydrateDrafts();
    expect(Object.keys(drafts)).toEqual(["C2"]);
  });

  test("a failed list marks ready but not hydrated, and can retry", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    server.state.failList = true;
    expect(await hydrateDrafts()).toBe(false);
    expect(draftsReady()).toBe(true);
    expect(Object.keys(drafts)).toEqual([]);
    server.state.failList = false;
    expect(await hydrateDrafts()).toBe(true);
    expect(Object.keys(drafts)).toEqual(["C1"]);
  });

  test("a list that lands after resetDrafts is dropped", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    server.holdList();
    const pending = hydrateDrafts();
    resetDrafts();
    server.releaseList();
    expect(await pending).toBe(false);
    expect(Object.keys(drafts)).toEqual([]);
    expect(draftsReady()).toBe(false);
    server.holdList();
    server.releaseList();
    expect(await hydrateDrafts()).toBe(true);
    expect(Object.keys(drafts)).toEqual(["C1"]);
  });
});

describe("remote events", () => {
  test("ignored until hydrated", () => {
    applyRemoteDraft(entry("a", "C1"));
    expect(Object.keys(drafts)).toEqual([]);
  });

  test("newer replaces, same or older is ignored", async () => {
    server = fakeDraftServer([entry("a", "C1", "5")]);
    await hydrateDrafts();
    applyRemoteDraft({ ...entry("a", "C1", "4"), blocks: blocks("old") });
    applyRemoteDraft({ ...entry("a", "C1", "5"), blocks: blocks("same") });
    expect(drafts.C1?.[0]?.blocks).toEqual(blocks("a"));
    applyRemoteDraft({ ...entry("a", "C1", "6"), blocks: blocks("new") });
    expect(drafts.C1?.[0]?.blocks).toEqual(blocks("new"));
    expect(drafts.C1).toHaveLength(1);
  });

  test("delete removes the entry and drops empty keys", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("b", "C1"), entry("c", "C1", "1", "9.9")]);
    await hydrateDrafts();
    removeRemoteDraft("a");
    expect(drafts.C1?.map((item) => item.id)).toEqual(["b"]);
    removeRemoteDraft("b");
    removeRemoteDraft("c");
    expect(Object.keys(drafts)).toEqual([]);
    expect(channelHasDraft("C1")).toBe(false);
  });
});

describe("channel views", () => {
  test("draftsForChannel includes thread drafts of that channel only", () => {
    upsertEntry("C1", entry("a", "C1"));
    upsertEntry("C1:thread:9.9", entry("b", "C1", "1", "9.9"));
    upsertEntry("C10", entry("c", "C10"));
    const found = draftsForChannel("C1");
    expect(found.map((item) => [item.id, item.threadTs])).toEqual([
      ["a", undefined],
      ["b", "9.9"],
    ]);
    expect(channelHasDraft("C1")).toBe(true);
    expect(channelHasDraft("C")).toBe(false);
  });

  test("draftsForChannel updates when a second draft joins a channel that already has one", () => {
    const seen: string[][] = [];
    const dispose = createRoot((stop) => {
      createEffect(() => {
        seen.push(draftsForChannel("C1").map((item) => item.id));
      });
      return stop;
    });
    upsertEntry("C1", entry("a", "C1"));
    upsertEntry("C1", entry("b", "C1"));
    upsertEntry("C1", { ...entry("b", "C1"), blocks: blocks("changed") });
    dispose();
    expect(seen).toEqual([[], ["a"], ["a", "b"], ["a", "b"]]);
  });
});

describe("local writes", () => {
  test("deleteEntry sends the known timestamp and removes the entry", async () => {
    server = fakeDraftServer();
    upsertEntry("C1", entry("a", "C1", "42"));
    await deleteEntry("C1", "a");
    const call = server.calls.find((item) => item.method === "DELETE");
    expect(call?.path).toBe("/api/drafts/a");
    expect(call?.body).toEqual({ lastUpdatedTs: "42" });
    expect(drafts.C1).toBeUndefined();
  });

  test("seedDraft saves a text draft under the thread key", async () => {
    server = fakeDraftServer();
    await seedDraft("C1", "9.9", "hello");
    const saved = drafts["C1:thread:9.9"];
    expect(saved).toHaveLength(1);
    expect(saved?.[0]?.blocks).toEqual(blocks("hello"));
  });

  test("seedDraft ignores blank text", async () => {
    server = fakeDraftServer();
    await seedDraft("C1", undefined, "   ");
    expect(server.calls).toEqual([]);
  });
});
