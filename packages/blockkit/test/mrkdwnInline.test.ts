import { describe, expect, test } from "bun:test";
import { forAll, pick, text } from "@slock/core/testing";
import { parseChannelId } from "@slock/slack";
import { type InlineNode, parseArchiveLink, parseInline } from "../src/mrkdwn/mrkdwnInline";

describe("canvas token", () => {
  test("parses id only", () => {
    expect(parseInline("<!canvas^F123>")).toEqual([
      { fileId: "F123", label: undefined, t: "canvas" },
    ]);
  });

  test("parses id with label", () => {
    expect(parseInline("see <!canvas^F123|Q3 plan> now")).toEqual([
      { t: "text", text: "see " },
      { fileId: "F123", label: "Q3 plan", t: "canvas" },
      { t: "text", text: " now" },
    ]);
  });

  test("keeps pipes after the first in the label", () => {
    expect(parseInline("<!canvas^F1|a|b>")).toEqual([{ fileId: "F1", label: "a|b", t: "canvas" }]);
  });

  test("falls back to literal text without an id", () => {
    expect(parseInline("<!canvas^>")).toEqual([{ t: "text", text: "<!canvas^>" }]);
    expect(parseInline("<!canvas^|label>")).toEqual([{ t: "text", text: "<!canvas^|label>" }]);
  });
});

describe("tokens", () => {
  test.each<[string, InlineNode[]]>([
    ["<@U1>", [{ id: "U1", t: "user" }]],
    ["<#C1|general>", [{ id: "C1", label: "general", t: "channel" }]],
    ["<!subteam^S1|@devs>", [{ id: "S1", label: "@devs", t: "usergroup" }]],
    ["<!here>", [{ range: "here", t: "broadcast" }]],
    ["<!nobody>", [{ t: "text", text: "<!nobody>" }]],
    ["<https://a.b|site>", [{ label: "site", t: "link", url: "https://a.b" }]],
    [":wave::skin-tone-3:", [{ name: "wave::skin-tone-3", t: "emoji" }]],
  ])("parses %p", (input, expected) => {
    expect(parseInline(input)).toEqual(expected);
  });

  test("bare urls drop trailing punctuation", () => {
    expect(parseInline("go to https://a.b/c).")).toEqual([
      { t: "text", text: "go to " },
      { t: "link", url: "https://a.b/c" },
      { t: "text", text: ")." },
    ]);
  });

  test("never throws and keeps all plain text on garbage", () => {
    forAll(
      (random) =>
        Array.from({ length: 6 }, () =>
          pick(random, [
            "<",
            ">",
            "`",
            "*",
            "_",
            "~",
            ":",
            "|",
            "!canvas^",
            "@",
            "\u{1f600}",
            text(random, "ab "),
          ]),
        ).join(""),
      (input) => {
        expect(() => parseInline(input)).not.toThrow();
      },
    );
  });
});

describe("parseArchiveLink", () => {
  test.each([
    ["https://acme.slack.com/archives/C123", "C123", false],
    ["https://acme.slack.com/archives/C123/p1700000000123456", "C123", true],
    ["https://acme.enterprise.slack.com/archives/D9/?x=1", "D9", false],
  ])("parses %p", (url, channelId, isMessage) => {
    expect(parseArchiveLink(url)).toEqual({ channelId: parseChannelId(channelId), isMessage });
  });

  test("rejects other hosts and paths", () => {
    expect(parseArchiveLink("https://evil.com/archives/C123")).toBeNull();
    expect(parseArchiveLink("http://acme.slack.com/archives/C123")).toBeNull();
    expect(parseArchiveLink("https://acme.slack.com/team/U1")).toBeNull();
  });
});
