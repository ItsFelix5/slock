import { describe, expect, test } from "bun:test";
import { messageMentionUrl } from "../../../packages/slack/src/richText/messageMention";

const base = {
  channel_id: "C123ABC456",
  message_ts: "1720710212.123456",
  type: "message_mention",
} as const;
const permalink = "https://a.slack.com/archives/C123ABC456/p1720710212123456";

describe("messageMentionUrl", () => {
  test("keeps a given url", () => {
    const url = "https://b.slack.com/archives/C1/p1";
    expect(messageMentionUrl({ ...base, url }, "a.slack.com")).toBe(url);
  });

  test("builds a permalink from the spec's minimal element", () => {
    expect(messageMentionUrl(base, "a.slack.com")).toBe(permalink);
  });

  test("adds thread_ts only when it differs from message_ts", () => {
    expect(messageMentionUrl({ ...base, thread_ts: base.message_ts }, "a.slack.com")).toBe(
      permalink,
    );
    expect(messageMentionUrl({ ...base, thread_ts: "1720710000.000001" }, "a.slack.com")).toBe(
      `${permalink}?thread_ts=1720710000.000001`,
    );
  });
});
