import { expect, test } from "bun:test";
import { flush } from "solid-js";
import { A, B, settle, startChannels } from "./store/channelsHarness";

test("a newer bootstrap replaces the stars shown from the older one", async () => {
  const h = await startChannels({ starred: [A] });
  expect(h.store.isChannelStarred(A)).toBe(true);
  h.server.starred = [B];
  await h.refreshStarred();
  await settle();
  expect(h.store.isChannelStarred(A)).toBe(false);
  expect(h.store.isChannelStarred(B)).toBe(true);
  h.stop();
});

test("star events change the stored list", async () => {
  const h = await startChannels({ starred: [A] });
  h.store.setChannelStarred(A, false);
  h.store.setChannelStarred(B, true);
  flush();
  expect(h.store.isChannelStarred(A)).toBe(false);
  expect(h.store.isChannelStarred(B)).toBe(true);
  h.stop();
});
