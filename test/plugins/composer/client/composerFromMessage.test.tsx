import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { BlockKit } from "@slock/blockkit";
import type { Block } from "@slock/types";
import { render } from "@solidjs/web";
import { buildRichTextBlocks } from "../../../../packages/plugins/src/composer/client/lib/richTextBuild";
import { handleMessageCopy } from "../../../../packages/plugins/src/message-links/client/messageCopy";
import { forAll } from "../../../support/core";
import { bootComposerHost, type ComposerFixture, mountComposer } from "./composerHarness";
import { editorState } from "./editorStates";

let composer: ComposerFixture;
const disposers: (() => void)[] = [];

beforeAll(async () => {
  await bootComposerHost();
  composer = await mountComposer();
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.querySelector(".message-list")?.remove();
});

afterAll(() => composer.dispose());

function showMessage(blocks: Block[]): HTMLElement {
  const list = document.createElement("div");
  list.className = "message-list";
  document.body.append(list);
  disposers.push(render(() => <BlockKit blocks={blocks} />, list));
  return list;
}

function copyWholeMessage(list: HTMLElement): DataTransfer {
  window.getSelection()?.selectAllChildren(list);
  const data = new DataTransfer();
  handleMessageCopy(new ClipboardEvent("copy", { cancelable: true, clipboardData: data }));
  return data;
}

describe("copy a rendered message and paste it into the composer", () => {
  test("the composer holds the message it was copied from", () => {
    forAll(
      (random) =>
        buildRichTextBlocks(editorState(random, { codeBlocks: false, emptyBlocks: false })),
      (blocks) => {
        const list = showMessage(blocks);
        const data = copyWholeMessage(list);
        composer.fill([]);
        composer.paste(data);
        expect(composer.blocks()).toEqual(blocks);
      },
      100,
    );
  });

  test("sending the pasted copy posts the same blocks", async () => {
    const blocks = buildRichTextBlocks([
      { insert: "hello " },
      { attributes: { bold: true }, insert: "world" },
      { insert: " and " },
      { insert: { mention: { id: "U1", kind: "user", name: "ann" } } },
      { insert: "\nquoted\n", attributes: undefined },
    ]);
    const data = copyWholeMessage(showMessage(blocks));
    composer.fill([]);
    composer.paste(data);
    expect((await composer.send()).blocks).toEqual(blocks);
  });
});
