import type { DeltaOp } from "../../../src/composer/client/lib/deltaLines";

const INLINE_ATTRIBUTES = ["bold", "italic", "strike", "code", "link"];

export function inlineTokens(ops: readonly DeltaOp[]): string[] {
  const tokens: string[] = [];
  for (const op of ops) {
    if (typeof op.insert !== "string") {
      tokens.push(JSON.stringify([op.insert]));
      continue;
    }
    const marks = Object.fromEntries(
      INLINE_ATTRIBUTES.filter((key) => op.attributes?.[key]).map((key) => [
        key,
        op.attributes?.[key],
      ]),
    );
    for (const char of op.insert) if (char !== "\n") tokens.push(JSON.stringify([char, marks]));
  }
  return tokens;
}
