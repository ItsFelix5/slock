import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import { detectMentionTrigger } from "../../../../src/composer/client/lib/textDetection";

type Kind = NonNullable<ReturnType<typeof detectMentionTrigger>>["kind"];

const at = (value: string, cursor = value.length, perLine = false, custom: string[] = []) =>
  detectMentionTrigger(value, cursor, perLine, custom);

describe("detectMentionTrigger", () => {
  test.each<[string, Kind, string, number]>([
    ["@al", "user", "al", 0],
    ["hi @al", "user", "al", 3],
    ["#gen", "channel", "gen", 0],
    ["see #gen", "channel", "gen", 4],
    [":smi", "emoji", "smi", 0],
    ["~tmpl", "template", "tmpl", 0],
    ["@/ann", "userlink", "ann", 0],
  ])("%p opens a %s picker", (value, kind, query, start) => {
    expect(at(value)).toEqual({ kind, query, start });
  });

  test("a trigger glued to a word is not a trigger", () => {
    expect(at("mail@host")).toBeNull();
    expect(at("a#b")).toBeNull();
    expect(at("12:30")).toBeNull();
  });

  test("a space after the trigger closes the picker", () => {
    expect(at("@al ice")).toBeNull();
  });

  test("the nearest trigger before the cursor wins", () => {
    expect(at("@bob #gen")).toMatchObject({ kind: "channel", query: "gen" });
    expect(at("#gen @bo")).toMatchObject({ kind: "user", query: "bo" });
  });

  test("only text before the cursor counts", () => {
    expect(at("@alice", 3)).toEqual({ kind: "user", query: "al", start: 0 });
    expect(at("hello @alice", 5)).toBeNull();
  });

  test("an emoji query of exactly one character stays closed", () => {
    expect(at(":")).toMatchObject({ kind: "emoji", query: "" });
    expect(at(":a")).toBeNull();
    expect(at(":ab")).toMatchObject({ kind: "emoji" });
    expect(at(":a.b")).toBeNull();
    expect(at(":+1x")).toMatchObject({ query: "+1x" });
  });

  test("slash opens commands only when the whole text is one word, unless per line", () => {
    expect(at("/rem")).toEqual({ kind: "command", query: "rem", start: 0 });
    expect(at("/remind me")).toBeNull();
    expect(at("/remind me", 10, true)).toEqual({ kind: "command", query: "remind me", start: 0 });
    expect(at("one\n/me waves", 13, true)).toEqual({
      kind: "command",
      query: "me waves",
      start: 4,
    });
    expect(at("one\n/me", 7, false)).toBeNull();
  });

  test("custom triggers open their own picker and keep the trigger", () => {
    expect(at("hi !go", 6, false, ["!"])).toEqual({
      kind: "custom",
      query: "go",
      start: 3,
      trigger: "!",
    });
    expect(at("a!go", 4, false, ["!"])).toBeNull();
  });

  test("never throws and always reports a start inside the text", () => {
    forAll(
      (random) => {
        const value = text(random, "ab @#:~/ \n+_1", 20);
        return {
          cursor: int(random, 0, value.length),
          perLine: pick(random, [true, false]),
          value,
        };
      },
      ({ cursor, perLine, value }) => {
        const found = at(value, cursor, perLine);
        if (!found) return;
        expect(found.start).toBeGreaterThanOrEqual(0);
        expect(found.start).toBeLessThanOrEqual(cursor);
        expect(value.slice(0, cursor)).toContain(found.query);
      },
    );
  });
});
