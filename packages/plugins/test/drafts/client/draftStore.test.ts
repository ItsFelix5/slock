import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ch, stamp } from "@slock/slack/testing";
import type { Block, DraftEntry } from "@slock/types";
import { createEffect, createRoot, flush } from "solid-js";
import { createDraftStore, draftCacheKey } from "../../../src/drafts/client/draftStore";
import { fakeDraftServer } from "./fakeDraftServer";

const blocks = (value: string): Block[] => [
  {
    elements: [{ elements: [{ text: value, type: "text" }], type: "rich_text_section" }],
    type: "rich_text",
  },
];

const entry = (
  id: string,
  channelId: string,
  lastUpdatedTs = "1",
  threadTs?: string,
): DraftEntry => ({
  blocks: blocks(id),
  channelId: ch(channelId),
  clientMsgId: `cmid-${id}`,
  id,
  lastUpdatedTs: stamp(lastUpdatedTs),
  threadTs: threadTs ? stamp(threadTs) : undefined,
});

let server: ReturnType<typeof fakeDraftServer>;
let store = createDraftStore();

beforeEach(() => {
  store = createDraftStore();
});

afterEach(() => {
  server?.restore();
  store.dispose();
});

const keys = () => Object.keys(store.drafts).sort();

describe("keys", () => {
  test("thread and channel drafts never share a key", () => {
    expect(draftCacheKey(ch("C1"))).not.toBe(draftCacheKey(ch("C1"), stamp("1.1")));
    expect(draftCacheKey(ch("C1"), stamp("1.1"))).not.toBe(draftCacheKey(ch("C1"), stamp("1.2")));
  });
});

describe("hydrate", () => {
  test("loads once and groups by channel and thread", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("b", "C1", "1", "9.9"), entry("c", "C2")]);
    expect(await store.hydrate()).toBe(true);
    expect(await store.hydrate()).toBe(true);
    expect(server.calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(keys()).toEqual(["C1", "C1:thread:9.9", "C2"]);
    expect(store.ready()).toBe(true);
  });

  test("dedupes concurrent calls", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    await Promise.all([store.hydrate(), store.hydrate(), store.hydrate()]);
    expect(server.calls.filter((call) => call.method === "GET")).toHaveLength(1);
  });

  test("keeps locally touched keys untouched", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("c", "C2")]);
    store.touch("C1");
    await store.hydrate();
    expect(keys()).toEqual(["C2"]);
  });

  test("a failed list marks ready but not hydrated, and can retry", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    server.state.failList = true;
    expect(await store.hydrate()).toBe(false);
    expect(store.ready()).toBe(true);
    expect(keys()).toEqual([]);
    server.state.failList = false;
    expect(await store.hydrate()).toBe(true);
    expect(keys()).toEqual(["C1"]);
  });

  test("a list that lands after dispose is dropped", async () => {
    server = fakeDraftServer([entry("a", "C1")]);
    server.holdList();
    const pending = store.hydrate();
    store.dispose();
    server.releaseList();
    expect(await pending).toBe(false);
    expect(keys()).toEqual([]);
    expect(store.ready()).toBe(false);
  });
});

describe("remote events", () => {
  test("ignored until hydrated", () => {
    store.applyRemote(entry("a", "C1"));
    flush();
    expect(keys()).toEqual([]);
  });

  test("newer replaces, same or older is ignored", async () => {
    server = fakeDraftServer([entry("a", "C1", "5")]);
    await store.hydrate();
    flush();
    store.applyRemote({ ...entry("a", "C1", "4"), blocks: blocks("old") });
    flush();
    store.applyRemote({ ...entry("a", "C1", "5"), blocks: blocks("same") });
    flush();
    expect(store.drafts.C1?.[0]?.blocks).toEqual(blocks("a"));
    store.applyRemote({ ...entry("a", "C1", "6"), blocks: blocks("new") });
    flush();
    expect(store.drafts.C1?.[0]?.blocks).toEqual(blocks("new"));
    expect(store.drafts.C1).toHaveLength(1);
  });

  test("delete removes the entry and drops empty keys", async () => {
    server = fakeDraftServer([entry("a", "C1"), entry("b", "C1"), entry("c", "C1", "1", "9.9")]);
    await store.hydrate();
    store.removeRemote("a");
    flush();
    expect(store.drafts.C1?.map((item) => item.id)).toEqual(["b"]);
    store.removeRemote("b");
    flush();
    store.removeRemote("c");
    flush();
    expect(keys()).toEqual([]);
    expect(store.channelHasDraft(ch("C1"))).toBe(false);
  });
});

describe("channel views", () => {
  test("draftsForChannel includes thread drafts of that channel only", () => {
    store.upsert(entry("a", "C1"));
    flush();
    store.upsert(entry("b", "C1", "1", "9.9"));
    flush();
    store.upsert(entry("c", "C10"));
    flush();
    const found = store.draftsForChannel(ch("C1"));
    expect(found.map((item) => [item.id, item.threadTs])).toEqual([
      ["a", undefined],
      ["b", "9.9"],
    ]);
    expect(store.channelHasDraft(ch("C1"))).toBe(true);
    expect(store.channelHasDraft(ch("CX"))).toBe(false);
  });

  test("draftsForChannel updates when a second draft joins a channel that already has one", () => {
    const seen: string[][] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => store.draftsForChannel(ch("C1")).map((item) => item.id),
        (ids) => {
          seen.push(ids);
        },
      );
      return stop;
    });
    flush();
    store.upsert(entry("a", "C1"));
    flush();
    store.upsert(entry("b", "C1"));
    flush();
    store.upsert({ ...entry("b", "C1"), blocks: blocks("changed") });
    flush();
    dispose();
    expect(seen).toEqual([[], ["a"], ["a", "b"], ["a", "b"]]);
  });
});

describe("local writes", () => {
  test("deleteEntry sends the known timestamp and removes the entry", async () => {
    server = fakeDraftServer();
    store.upsert(entry("a", "C1", "42"));
    flush();
    await store.deleteEntry("C1", "a");
    flush();
    const call = server.calls.find((item) => item.method === "DELETE");
    expect(call?.path).toBe("/api/drafts/a");
    expect(call?.body).toEqual({ lastUpdatedTs: "42" });
    expect(store.drafts.C1).toBeUndefined();
  });

  test("seedDraft saves a text draft under the thread key", async () => {
    server = fakeDraftServer();
    await store.seed(ch("C1"), stamp("9.9"), "hello");
    flush();
    const saved = store.drafts["C1:thread:9.9"];
    expect(saved).toHaveLength(1);
    expect(saved?.[0]?.blocks).toEqual(blocks("hello"));
  });

  test("seedDraft ignores blank text", async () => {
    server = fakeDraftServer();
    await store.seed(ch("C1"), undefined, "   ");
    expect(server.calls).toEqual([]);
  });
});
