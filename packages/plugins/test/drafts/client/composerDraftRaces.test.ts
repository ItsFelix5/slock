import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { drafts, removeRemoteDraft, resetDrafts } from "../../../src/drafts/client/draftStore";
import { blocks, mountReady, settle } from "./composerHarness";
import { fakeDraftServer } from "./fakeDraftServer";

let server: ReturnType<typeof fakeDraftServer>;

beforeEach(() => {
  jest.useFakeTimers();
  resetDrafts();
  server = fakeDraftServer();
});

afterEach(() => {
  jest.useRealTimers();
  server.restore();
  resetDrafts();
});

const serverTexts = () => server.state.drafts.map((d) => JSON.stringify(d.blocks));
const pendingFiles = { clear: () => {} };

describe("typing while the first save is in flight", () => {
  test("the server ends with one draft holding the latest text", async () => {
    const composer = await mountReady("C1");
    const release = server.holdWrites();
    composer.setCurrent(blocks("a"));
    jest.advanceTimersByTime(1000);
    await settle();
    composer.setCurrent(blocks("ab"));
    release();
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(server.state.drafts).toHaveLength(1);
    expect(serverTexts()).toEqual([JSON.stringify(blocks("ab"))]);
    expect(drafts.C1).toHaveLength(1);
    composer.dispose();
  });
});

describe("clearing the text", () => {
  test("typing again while the delete is in flight keeps the new text", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("first"));
    jest.advanceTimersByTime(1000);
    await settle();
    expect(server.state.drafts).toHaveLength(1);

    composer.setCurrent(blocks(""));
    const release = server.holdWrites();
    jest.advanceTimersByTime(1000);
    await settle();
    composer.setCurrent(blocks("second"));
    release();
    await settle();
    expect(composer.current()).toEqual(blocks("second"));
    jest.advanceTimersByTime(1000);
    await settle();
    expect(serverTexts()).toEqual([JSON.stringify(blocks("second"))]);
    composer.dispose();
  });
});

describe("sending", () => {
  test("a save still in flight when the message is sent leaves no draft behind", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("hello"));
    const release = server.holdWrites();
    jest.advanceTimersByTime(1000);
    await settle();
    const cleared = composer.state.clearAfterSend(pendingFiles);
    composer.setCurrent(blocks(""));
    release();
    await cleared;
    await settle();
    jest.advanceTimersByTime(2000);
    await settle();
    expect(server.state.drafts).toEqual([]);
    expect(drafts.C1).toBeUndefined();
    composer.dispose();
  });

  test("text typed right after a send becomes a fresh draft", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("sent"));
    jest.advanceTimersByTime(1000);
    await settle();
    await composer.state.clearAfterSend(pendingFiles);
    composer.setCurrent(blocks("next"));
    jest.advanceTimersByTime(1000);
    await settle();
    expect(serverTexts()).toEqual([JSON.stringify(blocks("next"))]);
    composer.dispose();
  });

  test("a draft that was never saved needs no delete", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("quick"));
    jest.advanceTimersByTime(300);
    await composer.state.clearAfterSend(pendingFiles);
    composer.setCurrent(blocks(""));
    jest.advanceTimersByTime(3000);
    await settle();
    expect(server.state.drafts).toEqual([]);
    composer.dispose();
  });
});

describe("another device", () => {
  test("deleting the draft I am typing in does not wipe the editor", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("mine"));
    jest.advanceTimersByTime(1000);
    await settle();
    const [saved] = server.state.drafts;
    composer.setCurrent(blocks("mine and more"));
    server.state.drafts = [];
    removeRemoteDraft(saved?.id ?? "");
    await settle();
    expect(composer.current()).toEqual(blocks("mine and more"));
    jest.advanceTimersByTime(1000);
    await settle();
    expect(serverTexts()).toEqual([JSON.stringify(blocks("mine and more"))]);
    composer.dispose();
  });
});

describe("switching while saves are in flight", () => {
  test("the text comes back after a round trip through another conversation", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("keep me"));
    const release = server.holdWrites();
    jest.advanceTimersByTime(1000);
    await settle();
    composer.setKey("C2");
    await settle();
    composer.setKey("C1");
    release();
    await settle();
    expect(composer.current()).toEqual(blocks("keep me"));
    composer.dispose();
  });

  test("a save finishing in another conversation does not touch the one on screen", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("one"));
    const release = server.holdWrites();
    jest.advanceTimersByTime(1000);
    await settle();
    composer.setKey("C2");
    await settle();
    composer.setCurrent(blocks("two"));
    release();
    await settle();
    expect(composer.current()).toEqual(blocks("two"));
    jest.advanceTimersByTime(1000);
    await settle();
    const saved = Object.fromEntries(server.state.drafts.map((d) => [d.channelId, d.blocks]));
    expect(saved).toEqual({ C1: blocks("one"), C2: blocks("two") });
    composer.dispose();
  });

  test("each conversation keeps its own draft", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("one"));
    composer.setKey("C2");
    await settle();
    composer.setCurrent(blocks("two"));
    composer.setKey("C1:thread:1.1");
    await settle();
    composer.setCurrent(blocks("three"));
    jest.advanceTimersByTime(1000);
    await settle();
    const byChannel = server.state.drafts.map((d) => [d.channelId, d.threadTs, d.blocks]);
    expect(byChannel).toHaveLength(3);
    expect(server.state.drafts.map((d) => d.channelId).sort()).toEqual(["C1", "C1", "C2"]);
    composer.dispose();
  });
});
