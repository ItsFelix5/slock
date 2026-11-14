import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { forAll } from "@slock/core/testing";
import { bootComposerHost, type ComposerFixture, mountComposer, settle } from "./composerHarness";
import { editorState } from "./editorStates";

let composer: ComposerFixture;

beforeAll(async () => {
  await bootComposerHost();
  composer = await mountComposer();
});

afterAll(() => composer.dispose());

const ops = () => composer.quill.getContents().ops;

function html(markup: string): DataTransfer {
  const data = new DataTransfer();
  data.setData("text/html", markup);
  data.setData("text/plain", markup.replace(/<[^>]+>/g, ""));
  return data;
}

function plain(text: string): DataTransfer {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  return data;
}

describe("move whole lines", () => {
  test("a cut line comes back first with its newline and format", () => {
    forAll(
      (random) => ({ ops: editorState(random), pick: random() }),
      ({ ops: state, pick }) => {
        composer.fill(state);
        const lines = composer.quill.getLines();
        const line = lines[Math.floor(pick * (lines.length - 1))];
        if (!line || lines.length < 2) return;
        const start = composer.quill.getIndex(line);
        const length = line.length();
        const moved = composer.quill.getContents(start, length);
        const rest = composer.quill
          .getContents(0, start)
          .concat(composer.quill.getContents(start + length));
        composer.select(start, length);
        const data = composer.cut();
        composer.select(0);
        composer.paste(data);
        expect(ops()).toEqual(moved.concat(rest).ops);
      },
      150,
    );
  });
});

describe("copy from one composer into another", () => {
  test("the second composer holds the same message", async () => {
    const other = await mountComposer();
    try {
      forAll(
        (random) => [...editorState(random), { insert: "end\n" }],
        (state) => {
          composer.fill(state);
          const before = composer.blocks();
          composer.selectAll();
          const data = composer.copy();
          other.fill([]);
          other.paste(data);
          expect(other.blocks()).toEqual(before);
        },
        100,
      );
    } finally {
      other.dispose();
    }
  });
});

describe("paste from outside", () => {
  test("plain text keeps its line breaks", () => {
    composer.fill([]);
    composer.paste(plain("one\ntwo\n\nthree"));
    expect(composer.quill.getText()).toBe("one\ntwo\n\nthree\n");
  });

  test("headings from a web page become plain lines", () => {
    composer.fill([]);
    composer.paste(html("<h1>Title</h1><p>body</p>"));
    expect(ops().some((op) => op.attributes?.header)).toBe(false);
    expect(composer.quill.getText()).toBe("Title\nbody\n");
  });

  test("inline styles and lists survive", () => {
    composer.fill([]);
    composer.paste(html("<p><b>bold</b> and <i>italic</i></p><ul><li>one</li><li>two</li></ul>"));
    expect(ops()).toEqual([
      { attributes: { bold: true }, insert: "bold" },
      { insert: " and " },
      { attributes: { italic: true }, insert: "italic" },
      { insert: "\none" },
      { attributes: { list: "bullet" }, insert: "\n" },
      { insert: "two" },
      { attributes: { list: "bullet" }, insert: "\n" },
    ]);
  });

  test("a url pasted over selected text links it", () => {
    composer.fill([{ insert: "see docs now\n" }]);
    composer.select(4, 4);
    composer.paste(plain("https://example.com/x"));
    expect(ops()).toEqual([
      { insert: "see " },
      { attributes: { link: "https://example.com/x" }, insert: "docs" },
      { insert: " now\n" },
    ]);
  });

  test("tracking params are stripped from a pasted url", () => {
    composer.fill([]);
    composer.paste(plain("https://example.com/p?utm_source=mail&id=7"));
    expect(composer.quill.getText()).toBe("https://example.com/p?id=7\n");
  });

  test("pasting over a selection replaces it once", () => {
    composer.fill([{ insert: "keep drop keep\n" }]);
    composer.select(5, 4);
    composer.paste(plain("new"));
    expect(composer.quill.getText()).toBe("keep new keep\n");
  });
});

describe("suggestions", () => {
  test("Enter on a mention suggestion inserts it instead of sending", async () => {
    composer.fill([]);
    const count = composer.sent.length;
    composer.type("hi @an");
    await settle();
    composer.press("Enter");
    await settle();
    expect(composer.sent.length).toBe(count);
    expect(ops()).toEqual([
      { insert: "hi " },
      { insert: { mention: { id: "U1", kind: "user", name: "ann" } } },
      { insert: " \n" },
    ]);
  });

  test("Escape closes the menu and Enter then sends", async () => {
    composer.fill([]);
    composer.type("hi @an");
    await settle();
    composer.press("Escape");
    await settle();
    const message = await composer.send();
    expect(message.text).toContain("@an");
  });
});

describe("replies", () => {
  test("a reply posts into its thread and links the parent", async () => {
    const permalink = "https://x.slack.com/archives/C1/p1700000000000100";
    const reply = await mountComposer({
      replyTo: { onCancel: () => {}, onJump: () => {}, onSent: () => {}, permalink },
      threadTs: "1700000000.000100",
    });
    try {
      reply.fill([{ insert: "answer\n" }]);
      const message = await reply.send();
      expect(message.threadTs).toBe("1700000000.000100");
      expect(JSON.stringify(message.blocks)).toContain(permalink);
      expect(JSON.stringify(message.blocks)).toContain("answer");
    } finally {
      reply.dispose();
    }
  });
});
