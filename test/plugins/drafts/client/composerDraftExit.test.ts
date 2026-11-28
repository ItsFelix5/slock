import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { blocks, mountReady, settle } from "./composerHarness";
import { fakeDraftServer } from "./fakeDraftServer";

let server: Awaited<ReturnType<typeof fakeDraftServer>>;

beforeEach(async () => {
  server = await fakeDraftServer();
});

afterEach(() => {
  server.restore();
});

const writes = () => server.calls.filter((call) => call.method !== "GET");
const closeTab = async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  Reflect.deleteProperty(document, "visibilityState");
  await settle();
};

describe("closing the tab", () => {
  test("sends the waiting save at once, in a request that outlives the page", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("last words"));
    composer.env.advance(400);
    await closeTab();
    expect(writes()).toMatchObject([
      { body: { blocks: blocks("last words") }, keepalive: true, method: "PUT" },
    ]);
    composer.env.advance(2000);
    await settle();
    expect(writes()).toHaveLength(1);
    composer.dispose();
  });

  test("a just cleared draft is deleted", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("gone"));
    composer.env.advance(1000);
    await settle();
    composer.setCurrent(blocks(""));
    await closeTab();
    expect(writes().at(-1)).toMatchObject({ keepalive: true, method: "DELETE" });
    expect(server.state.drafts).toEqual([]);
    composer.dispose();
  });

  test("sends nothing when nothing is waiting", async () => {
    const composer = await mountReady("C1");
    await closeTab();
    expect(writes()).toEqual([]);
    composer.dispose();
  });

  test("a closed composer no longer listens", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("once"));
    composer.dispose();
    await settle();
    await closeTab();
    expect(writes()).toHaveLength(1);
  });
});

describe("deleting from outside the composer", () => {
  test("waits for the save in flight, so the draft stays deleted", async () => {
    const composer = await mountReady("C1");
    composer.setCurrent(blocks("first"));
    composer.env.advance(1000);
    await settle();
    const [saved] = server.state.drafts;
    composer.setCurrent(blocks("second"));
    const release = server.holdWrites();
    composer.env.advance(1000);
    await settle();
    const deleted = composer.store.deleteEntry("C1", saved?.id ?? "");
    release();
    await deleted;
    await settle();
    expect(server.state.drafts).toEqual([]);
    composer.dispose();
  });
});
