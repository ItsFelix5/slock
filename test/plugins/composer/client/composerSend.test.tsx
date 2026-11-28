import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Block } from "@slock/types";
import { forAllAsync } from "../../../support/core";
import { bootComposerHost, type ComposerFixture, mountComposer, settle } from "./composerHarness";
import { editorState } from "./editorStates";

let composer: ComposerFixture;

beforeAll(async () => {
  await bootComposerHost();
  composer = await mountComposer();
});

afterAll(() => composer.dispose());

const isBlank = () => composer.mrkdwn().trim() === "";

describe("send", () => {
  test("sends exactly the blocks the editor built and clears it", async () => {
    await forAllAsync(
      (random) => editorState(random),
      async (ops) => {
        composer.fill(ops);
        const blocks = composer.blocks();
        const count = composer.sent.length;
        if (isBlank()) {
          composer.press("Enter");
          await settle();
          expect(composer.sent.length).toBe(count);
          return;
        }
        const message = await composer.send();
        expect(message.blocks).toEqual(blocks);
        expect(message.channelId).toBe("C1");
        expect(composer.quill.getText()).toBe("\n");
      },
      100,
    );
  });

  test("a failed send puts the message back and the retry sends the same blocks", async () => {
    await forAllAsync(
      (random) => editorState(random),
      async (ops) => {
        composer.fill(ops);
        if (isBlank()) return;
        const before = composer.quill.getContents().ops;
        const blocks = composer.blocks();
        const count = composer.sent.length;
        composer.failNextSend();
        composer.press("Enter");
        await settle();
        expect(composer.sent.length).toBe(count);
        expect(composer.quill.getContents().ops).toEqual(before);
        expect((await composer.send()).blocks).toEqual(blocks);
      },
      60,
    );
  });

  test("two Enters in the same tick send once", async () => {
    composer.fill([{ insert: "hello\n" }]);
    const count = composer.sent.length;
    composer.press("Enter");
    composer.press("Enter");
    await settle();
    expect(composer.sent.length).toBe(count + 1);
  });

  test("Shift+Enter adds a line and does not send", async () => {
    composer.fill([{ insert: "hello\n" }]);
    composer.select(5);
    const count = composer.sent.length;
    composer.press("Enter", { shift: true });
    await settle();
    expect(composer.sent.length).toBe(count);
    expect(composer.quill.getText()).toBe("hello\n\n");
  });

  test("a whitespace-only message is not sent", async () => {
    composer.fill([{ insert: "   \n" }]);
    const count = composer.sent.length;
    composer.press("Enter");
    await settle();
    expect(composer.sent.length).toBe(count);
  });
});

describe("edit and save", () => {
  test("saving without changes hands back the blocks it was given", async () => {
    await forAllAsync(
      (random) => editorState(random),
      async (ops) => {
        composer.fill(ops);
        const initial = composer.blocks();
        if (isBlank()) return;
        const saved: Block[][] = [];
        const editor = await mountComposer({
          editing: {
            initialBlocks: initial,
            onCancel: () => {},
            onSave: (_text, blocks) => {
              if (blocks) saved.push(blocks);
              return Promise.resolve(true);
            },
          },
        });
        editor.press("Enter");
        await settle();
        editor.dispose();
        expect(saved).toEqual([initial]);
      },
      60,
    );
  });
});
