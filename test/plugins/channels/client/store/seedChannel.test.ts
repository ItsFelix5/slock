import { describe, expect, test } from "bun:test";
import type { Channel } from "@slock/types";
import { flush } from "solid-js";
import { ch } from "../../../../support/slack";
import { settle, startChannels } from "./channelsHarness";

const id = ch("C9");
const seeded: Channel = {
  archived: false,
  id,
  name: "seeded",
  private: false,
  topic: "",
  unread: false,
};

describe("seeded channels", () => {
  test("a channel seeded from the conversation view is known without a lookup", async () => {
    const h = await startChannels({});
    h.store.seedChannel(seeded);
    flush();
    expect(h.store.channelById(id)?.name).toBe("seeded");
    await settle();
    expect(h.requests("/api/channels/lookup")).toBe(0);
    h.stop();
  });

  test("an unseeded channel goes to the lookup", async () => {
    const h = await startChannels({});
    h.store.channelById(id);
    await settle();
    expect(h.requestBodies("/api/channels/lookup")).toEqual([`{"ids":["C9"]}`]);
    h.stop();
  });
});
