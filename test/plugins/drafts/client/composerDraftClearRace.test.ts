import { afterEach, beforeEach, expect, test } from "bun:test";
import { blocks, mountReady, settle } from "./composerHarness";
import { fakeDraftServer } from "./fakeDraftServer";

let server: Awaited<ReturnType<typeof fakeDraftServer>>;

beforeEach(async () => {
  server = await fakeDraftServer();
});

afterEach(() => {
  server.restore();
});

test("text typed while a clear waits on the first save is neither wiped nor deleted", async () => {
  const composer = await mountReady("C1");
  const release = server.holdWrites();
  composer.setCurrent(blocks("a"));
  composer.env.advance(1000);
  await settle();
  composer.setCurrent(blocks(""));
  composer.env.advance(1000);
  await settle();
  composer.setCurrent(blocks("b"));
  composer.env.advance(1000);
  await settle();
  release();
  await settle();
  composer.env.advance(2000);
  await settle();
  expect(composer.current()).toEqual(blocks("b"));
  expect(server.state.drafts.map((draft) => draft.blocks)).toEqual([blocks("b")]);
  composer.dispose();
});
