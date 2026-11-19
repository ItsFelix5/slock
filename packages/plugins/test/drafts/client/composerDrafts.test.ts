import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { blocks, mountReady, settle } from "./composerHarness";
import { fakeDraftServer } from "./fakeDraftServer";

let server: ReturnType<typeof fakeDraftServer>;

beforeEach(() => {
  server = fakeDraftServer();
});

afterEach(() => {
  server.restore();
});

const puts = () => server.calls.filter((call) => call.method === "PUT");

describe("autosave", () => {
  test("waits one second after the last edit and saves once", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("h"));
    composer.env.advance(900);
    composer.setCurrent(blocks("hello"));
    composer.env.advance(900);
    expect(puts()).toHaveLength(0);
    composer.env.advance(100);
    await settle();
    expect(puts()).toHaveLength(1);
    expect(puts()[0]?.body.blocks).toEqual(blocks("hello"));
    expect(composer.store.drafts.C1).toHaveLength(1);
    composer.dispose();
  });

  test("empty content never creates a draft", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("   "));
    composer.env.advance(2000);
    await settle();
    expect(puts()).toHaveLength(0);
    composer.dispose();
  });

  test("thread composers save under the thread key", async () => {
    const composer = await mountReady("C1:thread:9.9");
    composer.setCurrent(blocks("reply"));
    composer.env.advance(1000);
    await settle();
    expect(puts()[0]?.body).toMatchObject({ channelId: "C1", threadTs: "9.9" });
    expect(Object.keys(composer.store.drafts)).toEqual(["C1:thread:9.9"]);
    composer.dispose();
  });

  test("a failed save sets syncError and a retry clears it", async () => {
    const composer = await mountReady("C1");
    server.state.failSave = true;
    composer.setCurrent(blocks("hello"));
    composer.env.advance(1000);
    await settle();
    expect(composer.state.syncError()).toBe(true);
    server.state.failSave = false;
    await composer.state.retrySync();
    expect(composer.state.syncError()).toBe(false);
    composer.dispose();
  });
});

describe("switching conversations", () => {
  test("an edit still waiting to save is flushed, not dropped", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("unsaved"));
    composer.env.advance(400);
    composer.setKey("C2");
    await settle();
    expect(puts()).toHaveLength(1);
    expect(puts()[0]?.body).toMatchObject({ blocks: blocks("unsaved"), channelId: "C1" });
    expect(composer.store.drafts.C1).toHaveLength(1);
    composer.dispose();
  });

  test("returning to a conversation loads its saved draft", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("kept"));
    composer.env.advance(1000);
    await settle();
    composer.setKey("C2");
    await settle();
    composer.setKey("C1");
    await settle();
    expect(composer.current()).toEqual(blocks("kept"));
    composer.dispose();
  });
});

describe("cleanup", () => {
  test("disposing leaves no pending timers", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("typing"));
    expect(composer.env.pendingTimers()).toBeGreaterThan(0);
    composer.dispose();
    await settle();
    expect(composer.env.pendingTimers()).toBe(0);
    expect(puts()).toHaveLength(1);
  });
});
