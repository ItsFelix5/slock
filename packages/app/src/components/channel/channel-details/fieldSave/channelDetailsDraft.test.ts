// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { ChannelDetails } from "@slock/slack-api";
import {
  type ChannelDetailsDraft,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./channelDetailsDraft";

function details(overrides: Partial<ChannelDetails> = {}): ChannelDetails {
  return {
    created: 1,
    id: "C123",
    name: "general",
    private: false,
    purpose: "Old purpose",
    topic: "Old topic",
    ...overrides,
  };
}

describe("mergeChannelDetailsDraft", () => {
  test("a topic refresh preserves unsaved typing in another field", () => {
    const previous = details();
    const current: ChannelDetailsDraft = {
      name: previous.name,
      purpose: "Purpose being typed",
      topic: "Saved topic",
    };
    const refreshed = details({ topic: "Saved topic" });

    expect(mergeChannelDetailsDraft(current, editableChannelDetails(previous), refreshed)).toEqual({
      name: "general",
      purpose: "Purpose being typed",
      topic: "Saved topic",
    });
  });

  test("untouched fields adopt external server changes", () => {
    const previous = details();
    const refreshed = details({ name: "announcements", purpose: "New purpose" });

    expect(
      mergeChannelDetailsDraft(
        editableChannelDetails(previous),
        editableChannelDetails(previous),
        refreshed,
      ),
    ).toEqual({ name: "announcements", purpose: "New purpose", topic: "Old topic" });
  });

  test("switching channels resets every field", () => {
    const previous = details();
    const next = details({ id: "C456", name: "random", purpose: "Other", topic: "Different" });

    expect(
      mergeChannelDetailsDraft(
        { name: "local name", purpose: "local purpose", topic: "local topic" },
        editableChannelDetails(previous),
        next,
      ),
    ).toEqual({ name: "random", purpose: "Other", topic: "Different" });
  });
});
