import { describe, expect, test } from "bun:test";
import { narrowByType } from "@slock/core";
import type { Block, RichTextBlock } from "@slock/types";
import {
  encodeReplyLink,
  INVISIBLE_LABEL,
  splitReplyLink,
  threadContainsMessage,
  withReplyLink,
} from "../../../../src/message-links/client/api/replyLink";

const PERMALINK = "https://team.slack.com/archives/C0123ABCD/p1700000000123456";
const REPLY_TARGET = { channelId: "C0123ABCD", ts: "1700000000.123456", url: PERMALINK };

function richText(...elements: RichTextBlock["elements"]): Block[] {
  return [{ elements, type: "rich_text" }];
}

describe("splitReplyLink on text", () => {
  test("strips an encoded invisible link and keeps the reply text", () => {
    const result = splitReplyLink({ text: `${encodeReplyLink(PERMALINK)} thanks!` });
    expect(result.replyRef).toEqual(REPLY_TARGET);
    expect(result.text).toBe("thanks!");
  });

  test("a bare permalink followed by text is a reply", () => {
    const result = splitReplyLink({ text: `${PERMALINK} agreed` });
    expect(result.replyRef).toEqual(REPLY_TARGET);
    expect(result.text).toBe("agreed");
  });

  test("a permalink alone is just a link", () => {
    expect(splitReplyLink({ text: PERMALINK }).replyRef).toBeNull();
    expect(splitReplyLink({ text: `<${PERMALINK}|.>` }).replyRef).toBeNull();
  });

  test("a labelled link outside a thread stays a normal message", () => {
    const text = `<${PERMALINK}|read this> please`;
    const result = splitReplyLink({ text });
    expect(result.replyRef).toBeNull();
    expect(result.text).toBe(text);
  });

  test("a permalink query string does not break the target", () => {
    const url = `${PERMALINK}?thread_ts=1700000000.000100&cid=C0123ABCD`;
    expect(splitReplyLink({ text: `${url} hi` }).replyRef?.ts).toBe("1700000000.123456");
  });

  test("non slack hosts are not replies", () => {
    const text = "https://example.com/archives/C0123ABCD/p1700000000123456 hi";
    expect(splitReplyLink({ text }).replyRef).toBeNull();
  });

  test("short digit runs are not timestamps", () => {
    const text = "https://team.slack.com/archives/C0123ABCD/p12 hi";
    expect(splitReplyLink({ text }).replyRef).toBeNull();
  });

  test("a thread filter decides if a labelled link is a reply", () => {
    const text = `<${PERMALINK}|label> hi`;
    expect(splitReplyLink({ text }, () => true).replyRef).toEqual(REPLY_TARGET);
    expect(splitReplyLink({ text }, () => false).replyRef).toBeNull();
  });
});

describe("splitReplyLink on blocks", () => {
  test("withReplyLink then splitReplyLink round trips the original blocks", () => {
    const original = richText({
      elements: [{ text: "hello", type: "text" }],
      type: "rich_text_section",
    });
    const wrapped = withReplyLink(original, PERMALINK);
    const result = splitReplyLink({ blocks: wrapped, text: "" });
    expect(result.replyRef).toEqual(REPLY_TARGET);
    expect(result.blocks).toEqual(original);
  });

  test("a leading list gets its own section for the link", () => {
    const list: RichTextBlock["elements"] = [
      { elements: [], style: "bullet", type: "rich_text_list" },
    ];
    const wrapped = withReplyLink(richText(...list), PERMALINK);
    const block = narrowByType<Block, RichTextBlock>(wrapped[0], "rich_text");
    expect(block?.elements[0]?.type).toBe("rich_text_section");
    expect(block?.elements[1]?.type).toBe("rich_text_list");
  });

  test("a message mention is a reply target", () => {
    const blocks = richText({
      elements: [
        {
          channel_id: "C0123ABCD",
          message_ts: "1700000000.123456",
          type: "message_mention",
          url: PERMALINK,
        },
        { text: " ok", type: "text" },
      ],
      type: "rich_text_section",
    });
    const result = splitReplyLink({ blocks, text: "" });
    expect(result.replyRef).toEqual(REPLY_TARGET);
  });

  test("blocks with only the link collapse to nothing", () => {
    const blocks = richText({
      elements: [{ text: INVISIBLE_LABEL, type: "link", url: PERMALINK }],
      type: "rich_text_section",
    });
    expect(splitReplyLink({ blocks, text: "" }).blocks).toBeUndefined();
  });

  test("non rich text blocks pass through", () => {
    const blocks: Block[] = [{ text: { text: "hi", type: "mrkdwn" }, type: "section" }];
    const result = splitReplyLink({ blocks, text: "hi" });
    expect(result.replyRef).toBeNull();
    expect(result.blocks).toEqual(blocks);
  });
});

describe("threadContainsMessage", () => {
  const messages = [{ ts: "2" }, { ts: "3" }];

  test.each([
    ["root", "1", "C1", "1", true],
    ["reply", "1", "C1", "3", true],
    ["other channel", "1", "C2", "3", false],
    ["unknown ts", "1", "C1", "9", false],
  ])("%s", (_name, threadTs, channelId, targetTs, expected) => {
    expect(threadContainsMessage("C1", threadTs, messages, channelId, targetTs)).toBe(expected);
  });

  test("a message without a thread never matches", () => {
    expect(threadContainsMessage("C1", undefined, messages, "C1", "2")).toBe(false);
  });
});
