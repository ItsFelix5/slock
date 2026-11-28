import { describe, expect, test } from "bun:test";
import {
  dateMrkdwn,
  describeEmbed,
  type EmbedInsert,
  embedText,
  type MentionValue,
} from "../../../../../packages/plugins/src/composer/client/lib/embedValues";
import { forAll, int, pick, text } from "../../../../support/core";

const mention = (kind: MentionValue["kind"], id: string, name = "n"): EmbedInsert => ({
  mention: { id, kind, name },
});

describe("embedText", () => {
  test.each([
    [mention("user", "U1"), "<@U1>"],
    [mention("special", "here"), "<!here>"],
    [mention("usergroup", "S1"), "<!subteam^S1>"],
    [mention("channel", "C1", "general"), "<#C1|general>"],
    [
      mention("messagelink", "https://x.slack.com/archives/C1/p1"),
      "<https://x.slack.com/archives/C1/p1>",
    ],
    [{ emoji: "tada" }, ":tada:"],
    [{ divider: true }, "---"],
    [
      { date: { fallback: "today", format: "{date}", ts: 1700000000 } },
      "<!date^1700000000^{date}|today>",
    ],
  ])("%j becomes %p", (embed, expected) => {
    expect(embedText(embed)).toBe(expected);
  });

  test("a userlink with an unusable id falls back to the plain name", () => {
    expect(embedText(mention("userlink", "not an id", "Ann"))).toBe("@Ann");
  });

  test("an empty embed is empty text", () => {
    expect(embedText({})).toBe("");
  });
});

describe("describeEmbed", () => {
  test("reads each embed kind from a quill insert", () => {
    expect(describeEmbed({ mention: { id: "U1", kind: "user", name: "a" } })).toEqual(
      mention("user", "U1", "a"),
    );
    expect(describeEmbed({ emoji: { name: "tada" } })).toEqual({ emoji: "tada" });
    expect(describeEmbed({ divider: true })).toEqual({ divider: true });
  });

  test("rejects malformed values instead of guessing", () => {
    expect(describeEmbed({ mention: { id: "U1", kind: "bogus", name: "a" } })).toBeUndefined();
    expect(describeEmbed({ mention: { id: 1, kind: "user", name: "a" } })).toBeUndefined();
    expect(describeEmbed({ emoji: { name: 3 } })).toBeUndefined();
    expect(describeEmbed({ date: { fallback: "x", format: "y", ts: "1" } })).toBeUndefined();
    expect(describeEmbed({})).toBeUndefined();
  });

  test("a mention wins over other keys on the same insert", () => {
    expect(
      describeEmbed({ emoji: { name: "x" }, mention: { id: "U1", kind: "user", name: "a" } }),
    ).toEqual(mention("user", "U1", "a"));
  });

  test("describing a generated insert and printing it gives its mrkdwn", () => {
    const kinds = ["user", "channel", "special", "usergroup", "messagelink"] as const;
    forAll(
      (random) => ({
        id: text(random, "ABC123", 8) || "X",
        kind: pick(random, kinds),
        name: text(random, "abc", 6),
        ts: int(random, 0, 2e9),
      }),
      ({ id, kind, name, ts }) => {
        const embed = describeEmbed({ mention: { id, kind, name } });
        expect(embed).toEqual(mention(kind, id, name));
        if (embed) expect(embedText(embed)).toContain(id);
        const date = describeEmbed({ date: { fallback: name, format: "{date}", ts } });
        expect(date && embedText(date)).toBe(dateMrkdwn({ fallback: name, format: "{date}", ts }));
      },
    );
  });
});
