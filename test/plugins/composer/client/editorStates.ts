import type { DeltaOp } from "../../../../packages/plugins/src/composer/client/lib/deltaLines";
import { int, pick, type Random } from "../../../support/core";

const MARKS = ["bold", "italic", "strike", "code"] as const;
type BlockStyle = "plain" | Record<string, string | boolean>;

const TEXT_BLOCK_STYLES: readonly BlockStyle[] = [
  "plain",
  "plain",
  "plain",
  { blockquote: true },
  { list: "bullet" },
  { list: "ordered" },
];
const BLOCK_STYLES: readonly BlockStyle[] = [...TEXT_BLOCK_STYLES, { "code-block": true }];
const EMBEDS = [
  { mention: { id: "U1", kind: "user", name: "ann" } },
  { mention: { id: "U2", kind: "user", name: "bob" } },
  { mention: { id: "C1", kind: "channel", name: "general" } },
  { mention: { id: "here", kind: "special", name: "here" } },
  { mention: { id: "S1", kind: "usergroup", name: "devs" } },
  { emoji: { name: "tada" } },
  { emoji: { name: "+1" } },
  { date: { fallback: "noon", format: "{date_short}", ts: 1700000000 } },
] as const;
const WORDS = [
  "a",
  "b c",
  " lead",
  "trail ",
  " both ",
  "  ",
  "x\u{1F600}",
  "é",
  "*",
  "_",
  "`",
  "~",
  "<b>",
  "a&b",
];

function inline(random: Random): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (let i = int(random, 0, 5); i > 0; i--) {
    if (int(random, 0, 9) <= 1) {
      ops.push({ insert: pick(random, EMBEDS) });
      continue;
    }
    const marks = Object.fromEntries(
      MARKS.filter(() => random() < 0.25).map((mark) => [mark, true]),
    );
    const link = random() < 0.15 ? { link: "https://a.b/c" } : {};
    const attributes = { ...marks, ...link };
    ops.push({
      attributes: Object.keys(attributes).length ? attributes : undefined,
      insert: pick(random, WORDS),
    });
  }
  return ops;
}

interface EditorStateOptions {
  codeBlocks?: boolean;
  emptyBlocks?: boolean;
}

export function editorState(
  random: Random,
  { codeBlocks = true, emptyBlocks = true }: EditorStateOptions = {},
): DeltaOp[] {
  const styles = codeBlocks ? BLOCK_STYLES : TEXT_BLOCK_STYLES;
  const ops: DeltaOp[] = [];
  for (let i = int(random, 0, 9); i > 0; i--) {
    const style = pick(random, styles);
    const empty = style !== "plain" && emptyBlocks && random() < 0.3;
    const content = empty ? [] : inline(random);
    if (!empty && content.length === 0) content.push({ insert: "word" });
    ops.push(...content);
    ops.push({ attributes: style === "plain" ? undefined : style, insert: "\n" });
  }
  return ops;
}
