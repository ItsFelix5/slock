import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { forAll, int, type Random } from "@slock/core/testing";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import { bootComposerHost, type ComposerFixture, mountComposer } from "./composerHarness";
import { editorState } from "./editorStates";
import { inlineTokens } from "./editorTokens";

let composer: ComposerFixture;

beforeAll(async () => {
  await bootComposerHost();
  composer = await mountComposer();
});

afterAll(() => composer.dispose());

const LOW_SURROGATE = /[\uDC00-\uDFFF]/;

function snapped(index: number): number {
  const text = indexAlignedText(composer.quill);
  return LOW_SURROGATE.test(text[index] ?? "") ? index - 1 : index;
}

function lineRange(random: Random) {
  const lines = composer.quill.getLines();
  const line = lines[int(random, 0, lines.length - 1)];
  if (!line) throw new Error("editor has no lines");
  const start = composer.quill.getIndex(line);
  const length = line.length() - 1;
  const from = snapped(start + int(random, 0, length));
  const to = snapped(start + int(random, from - start, length));
  return { from, length: to - from };
}

describe("select all, copy, paste over the selection", () => {
  test("sends what it would have sent before", () => {
    forAll(
      (random) => editorState(random),
      (ops) => {
        composer.fill(ops);
        const before = composer.blocks();
        composer.selectAll();
        composer.paste(composer.copy());
        expect(composer.blocks()).toEqual(before);
      },
      150,
    );
  });
});

describe("cut part of a line and paste it back in place", () => {
  test("sends what it would have sent before", () => {
    forAll(
      (random) => ({ ops: editorState(random), range: random() }),
      ({ ops, range }) => {
        composer.fill(ops);
        const before = composer.blocks();
        const { from, length } = lineRange(() => range);
        composer.select(from, length);
        const data = composer.cut();
        composer.select(from);
        composer.paste(data);
        expect(composer.blocks()).toEqual(before);
      },
      150,
    );
  });
});

describe("copy a range and paste it somewhere else", () => {
  test("every character and embed keeps its marks and lands once at the caret", () => {
    forAll(
      (random) => ({
        at: int(random, 0, 1000),
        length: int(random, 1, 1000),
        ops: editorState(random, { codeBlocks: false }),
        start: int(random, 0, 1000),
      }),
      ({ at, length, ops, start }) => {
        composer.fill(ops);
        const total = composer.quill.getLength() - 1;
        const from = snapped(start % (total + 1));
        const size = Math.min(length, total - from);
        const target = snapped(at % (total + 1));
        const original = inlineTokens(composer.quill.getContents().ops);
        const copied = inlineTokens(composer.quill.getContents(from, size).ops);
        const caret = inlineTokens(composer.quill.getContents(0, target).ops).length;
        composer.select(from, size);
        const data = composer.copy();
        composer.select(target);
        composer.paste(data);
        expect(inlineTokens(composer.quill.getContents().ops)).toEqual([
          ...original.slice(0, caret),
          ...copied,
          ...original.slice(caret),
        ]);
      },
      150,
    );
  });
});
