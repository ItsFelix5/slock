// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, mock, test } from "bun:test";
import { navigateToSlackPermalink, parseSlackPermalink } from "../slackPermalink";

describe("Slack permalink navigation", () => {
  test("opens a root message in its channel without inventing a thread", () => {
    const openChannelMessage = mock(() => {});
    const openChannelPeek = mock(() => {});
    const target = parseSlackPermalink(
      "https://workspace.slack.com/archives/C123/p1700000000123456",
    );
    if (!target) throw new Error("Expected a valid permalink");

    navigateToSlackPermalink(target, { openChannelMessage, openChannelPeek });

    expect(openChannelMessage).toHaveBeenCalledWith("C123", "1700000000.123456");
    expect(openChannelPeek).not.toHaveBeenCalled();
  });

  test("opens a reply in its parent thread and highlights that reply", () => {
    const openChannelMessage = mock(() => {});
    const openChannelPeek = mock(() => {});
    const target = parseSlackPermalink(
      "https://workspace.slack.com/archives/C123/p1700000001123456?thread_ts=1700000000.123456",
    );
    if (!target) throw new Error("Expected a valid permalink");

    navigateToSlackPermalink(target, { openChannelMessage, openChannelPeek });

    expect(openChannelPeek).toHaveBeenCalledWith("C123", "1700000000.123456", "1700000001.123456");
    expect(openChannelMessage).not.toHaveBeenCalled();
  });
});
