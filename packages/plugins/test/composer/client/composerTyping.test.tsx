import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { forAll } from "@slock/core/testing";
import { bootComposerHost, type ComposerFixture, mountComposer, settle } from "./composerHarness";
import { editorState } from "./editorStates";

let composer: ComposerFixture;

beforeAll(async () => {
  await bootComposerHost();
  composer = await mountComposer();
});

beforeEach(() => composer.fill([]));

afterAll(() => composer.dispose());

const ops = () => composer.quill.getContents().ops;

describe("inline marks while typing", () => {
  test.each([
    ["*", "bold"],
    ["_", "italic"],
    ["~", "strike"],
    ["`", "code"],
  ])("%s wraps a word into %s and the next word is plain", (char, mark) => {
    composer.type(`hi ${char}word${char} next`);
    expect(ops()).toEqual([
      { insert: "hi " },
      { attributes: { [mark]: true }, insert: "word" },
      { insert: " next\n" },
    ]);
  });

  test("a marker glued to a word does nothing", () => {
    composer.type("snake_case_name");
    expect(ops()).toEqual([{ insert: "snake_case_name\n" }]);
  });

  test("markers inside code stay literal", () => {
    composer.type("`a*b*`");
    expect(ops()).toEqual([{ attributes: { code: true }, insert: "a*b*" }, { insert: "\n" }]);
  });
});

describe("line prefixes", () => {
  test.each([
    ["> quote", { blockquote: true }],
    ["- item", { list: "bullet" }],
    ["1. item", { list: "ordered" }],
    ["# title", { header: 1 }],
    ["### title", { header: 3 }],
  ])("%s", (typed, attributes) => {
    composer.type(typed);
    const [text] = typed.split(" ").slice(1);
    expect(ops()).toEqual([{ insert: text }, { attributes, insert: "\n" }]);
  });

  test("three backticks open a code block", () => {
    composer.type("```");
    expect(ops()).toEqual([{ attributes: { "code-block": true }, insert: "\n" }]);
  });
});

describe("links and emoji", () => {
  test("a url followed by a space becomes a link", () => {
    composer.type("see https://example.com now");
    expect(ops()).toEqual([
      { insert: "see " },
      { attributes: { link: "https://example.com" }, insert: "https://example.com" },
      { insert: " now\n" },
    ]);
  });

  test("a shortcode becomes an emoji", () => {
    composer.type("go :tada:");
    expect(ops()).toEqual([
      { insert: "go " },
      { insert: { emoji: { name: "tada" } } },
      { insert: "\n" },
    ]);
  });
});

describe("undo", () => {
  test("restores everything a cut removed", () => {
    forAll(
      (random) => editorState(random),
      (state) => {
        composer.fill(state);
        const before = ops();
        composer.selectAll();
        composer.cut();
        composer.press("z", { mod: true });
        expect(ops()).toEqual(before);
      },
      80,
    );
  });

  test("restores what a paste over the selection replaced", () => {
    forAll(
      (random) => ({ copied: editorState(random), target: editorState(random) }),
      ({ copied, target }) => {
        composer.fill(copied);
        composer.selectAll();
        const data = composer.copy();
        composer.fill(target);
        const before = ops();
        composer.selectAll();
        composer.paste(data);
        composer.press("z", { mod: true });
        expect(ops()).toEqual(before);
      },
      80,
    );
  });

  test("redo brings an undone edit back", async () => {
    composer.type("one");
    composer.quill.history.cutoff();
    composer.type(" two");
    composer.press("z", { mod: true });
    expect(composer.quill.getText()).toBe("one\n");
    composer.press("z", { mod: true, shift: true });
    expect(composer.quill.getText()).toBe("one two\n");
    await settle();
  });
});
