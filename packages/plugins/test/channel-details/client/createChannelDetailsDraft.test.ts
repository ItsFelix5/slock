import { describe, expect, test } from "bun:test";
import { ch } from "@slock/slack/testing";
import type { ChannelDetails } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createChannelDetailsDraft } from "../../../src/channel-details/client/views/createChannelDetailsDraft";

const details = (overrides: Partial<ChannelDetails> = {}): ChannelDetails => ({
  archived: false,
  created: 0,
  id: ch("C1"),
  name: "general",
  private: false,
  purpose: "p",
  topic: "t",
  ...overrides,
});

function setup() {
  return createRoot(() => {
    const [source, setSource] = createSignal<ChannelDetails | undefined>(details());
    return { draft: createChannelDetailsDraft(source, () => {}), setSource };
  });
}

describe("createChannelDetailsDraft", () => {
  test("seeds fields from the loaded details", () => {
    const { draft } = setup();
    flush();
    expect([draft.name(), draft.topic(), draft.purpose()]).toEqual(["general", "t", "p"]);
    expect(draft.anyDirty()).toBe(false);
  });

  test("keeps an edited field and takes server changes for untouched ones", () => {
    const { draft, setSource } = setup();
    draft.setTopic("mine");
    flush();
    setSource(details({ purpose: "server purpose", topic: "server topic" }));
    flush();
    expect(draft.topic()).toBe("mine");
    expect(draft.purpose()).toBe("server purpose");
    expect(draft.anyDirty()).toBe(true);
  });

  test("keeps the draft while details are unavailable", () => {
    const { draft, setSource } = setup();
    draft.setName("renamed");
    flush();
    setSource(undefined);
    flush();
    expect(draft.name()).toBe("renamed");
  });
});
