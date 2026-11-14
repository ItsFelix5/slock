import { describe, expect, test } from "bun:test";
import { forAll, int, pick, type Random, text } from "@slock/core/testing";
import {
  type DeltaOp,
  deltaLines,
  mrkdwnText,
} from "../../../../src/composer/client/lib/deltaLines";

const user = (id: string): DeltaOp => ({
  insert: { mention: { id, kind: "user", name: "ada" } },
});
const line = (attributes?: Record<string, unknown>): DeltaOp => ({ attributes, insert: "\n" });

describe("mrkdwnText", () => {
  test("empty editor is empty", () => {
    expect(mrkdwnText([{ insert: "\n" }])).toBe("");
    expect(mrkdwnText([])).toBe("");
  });

  test("escapes slack control characters in plain text", () => {
    expect(mrkdwnText([{ insert: "a < b & c > d\n" }])).toBe("a &lt; b &amp; c &gt; d");
  });

  test("wraps marks around trimmed text and keeps the whitespace outside", () => {
    expect(mrkdwnText([{ attributes: { bold: true }, insert: " hi \n" }])).toBe(" *hi* ");
    expect(mrkdwnText([{ attributes: { bold: true }, insert: "  \n" }])).toBe("  ");
  });

  test("stacks marks and wraps links", () => {
    const ops: DeltaOp[] = [
      { attributes: { bold: true, italic: true, link: "https://a.b/?x=1&y=2" }, insert: "go" },
      { insert: "\n" },
    ];
    expect(mrkdwnText(ops)).toBe("<https://a.b/?x=1&amp;y=2|_*go*_>");
  });

  test("renders embeds as slack tokens", () => {
    const ops: DeltaOp[] = [
      user("U1"),
      { insert: " " },
      { insert: { mention: { id: "C1", kind: "channel", name: "dev" } } },
      { insert: { mention: { id: "here", kind: "special", name: "here" } } },
      { insert: { mention: { id: "S1", kind: "usergroup", name: "ops" } } },
      { insert: { emoji: { name: "tada::skin-tone-3" } } },
      { insert: { date: { fallback: "today", format: "{date}", ts: 5 } } },
      { insert: "\n" },
    ];
    expect(mrkdwnText(ops)).toBe(
      "<@U1> <#C1|dev><!here><!subteam^S1>:tada::skin-tone-3:<!date^5^{date}|today>",
    );
  });

  test("drops embeds with malformed values", () => {
    const ops: DeltaOp[] = [
      { insert: { mention: { id: 1, kind: "user", name: "x" } } },
      { insert: { mention: { id: "U", kind: "nope", name: "x" } } },
      { insert: { emoji: {} } },
      { insert: { date: { ts: "5", format: "f", fallback: "" } } },
      { insert: "ok\n" },
    ];
    expect(mrkdwnText(ops)).toBe("ok");
  });

  test("joins code block lines raw and skips blank blocks", () => {
    const code = { "code-block": true };
    expect(mrkdwnText([{ insert: "a<b" }, line(code), { insert: "c" }, line(code)])).toBe(
      "```a&lt;b\nc```",
    );
    expect(mrkdwnText([{ insert: "  " }, line(code)])).toBe("");
  });

  test("numbers ordered lists and restarts after other lines", () => {
    const ordered = { list: "ordered" };
    const ops: DeltaOp[] = [
      { insert: "a" },
      line(ordered),
      { insert: "b" },
      line(ordered),
      { insert: "mid" },
      line(),
      { insert: "c" },
      line({ list: "ordered", listOffset: 4 }),
      { insert: "d" },
      line({ list: "bullet" }),
    ];
    expect(mrkdwnText(ops)).toBe("1. a\n2. b\nmid\n5. c\n• d");
  });

  test("prefixes quote lines", () => {
    expect(mrkdwnText([{ insert: "q" }, line({ blockquote: true }), { insert: "p\n" }])).toBe(
      "> q\np",
    );
  });
});

describe("deltaLines", () => {
  test("drops trailing blank lines only", () => {
    expect(deltaLines([{ insert: "a\n\n\n" }]).length).toBe(1);
    expect(deltaLines([{ insert: "\n\na\n" }]).length).toBe(3);
    expect(deltaLines([{ insert: "x" }, line({ header: 1 }), line({ header: 1 })]).length).toBe(2);
  });

  test("merges neighbours with the same marks", () => {
    const [first] = deltaLines([
      { attributes: { bold: true }, insert: "a" },
      { attributes: { bold: true }, insert: "b" },
      { insert: "c\n" },
    ]);
    expect(first?.segments.map((segment) => segment.text)).toEqual(["ab", "c"]);
  });

  test("keeps surrogate pairs whole", () => {
    const [first] = deltaLines([{ insert: "a😀𝒳\u{1F468}‍\u{1F469}\n" }]);
    expect(first?.segments[0]?.text).toBe("a😀𝒳\u{1F468}‍\u{1F469}");
  });
});

const ALPHABET = "ab <>&*_~`:\u{1F600}אا \t";
const MARKS = ["bold", "italic", "strike", "code"] as const;
const BLOCKS = [
  undefined,
  { blockquote: true },
  { list: "bullet" },
  { "code-block": true },
] as const;

function randomOps(random: Random): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const count = int(random, 0, 12);
  for (let i = 0; i < count; i++) {
    const kind = int(random, 0, 5);
    if (kind === 0) ops.push(user(`U${int(random, 1, 9)}`));
    else if (kind === 1) ops.push({ insert: { emoji: { name: text(random, "abc_", 6) || "x" } } });
    else if (kind === 2) ops.push(line(BLOCKS[int(random, 0, BLOCKS.length - 1)]));
    else {
      const attributes = random() < 0.4 ? { [pick(random, MARKS)]: true } : undefined;
      ops.push({
        attributes,
        insert: `${text(random, ALPHABET, 12)}${random() < 0.3 ? "\n" : ""}`,
      });
    }
  }
  return ops;
}

describe("properties", () => {
  test("never throws and lines carry no newline", () => {
    forAll(randomOps, (ops) => {
      for (const current of deltaLines(ops)) {
        for (const segment of current.segments) expect(segment.text.includes("\n")).toBe(false);
      }
      expect(typeof mrkdwnText(ops)).toBe("string");
    });
  });

  test("plain text without marks survives except for escaping", () => {
    forAll(
      (random) => text(random, "ab <>&\u{1F600}\n", 40),
      (input) => {
        const ops: DeltaOp[] = [{ insert: `${input}\n` }];
        const expected = input
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replace(/\n+$/, "");
        expect(mrkdwnText(ops)).toBe(expected);
      },
    );
  });

  test("a very long document stays linear", () => {
    const ops: DeltaOp[] = Array.from({ length: 20000 }, (_, i) => ({
      attributes: i % 2 ? { bold: true } : undefined,
      insert: `word${i} `,
    }));
    ops.push({ insert: "\n" });
    const started = performance.now();
    expect(mrkdwnText(ops).length).toBeGreaterThan(100000);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
