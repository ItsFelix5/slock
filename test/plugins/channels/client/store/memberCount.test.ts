import { expect, test } from "bun:test";
import { flush } from "solid-js";
import { ch } from "../../../../support/slack";
import { settle, startChannels } from "./channelsHarness";

const id = ch("C9");

test("the member count comes from channel info and follows a refresh", async () => {
  const h = await startChannels({});
  h.store.seedChannel({
    archived: false,
    id,
    name: "seeded",
    private: false,
    topic: "",
    unread: false,
  });
  flush();
  const info = (count: number) =>
    new Response(JSON.stringify({ channel: { id, name: "seeded", num_members: count } }));

  const loaded = h.store.ensureChannelTopic(id);
  await settle();
  h.answer("/api/channels/C9", info(8));
  await loaded;
  flush();
  expect(h.store.channelById(id)?.memberCount).toBe(8);

  const refreshed = h.store.refreshChannelTopic(id);
  await settle();
  h.answer("/api/channels/C9", info(9));
  await refreshed;
  flush();
  expect(h.store.channelById(id)?.memberCount).toBe(9);
  h.stop();
});
