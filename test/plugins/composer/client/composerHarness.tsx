import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { parseChannelId } from "@slock/slack";
import type { Block } from "@slock/types";
import Quill, { Delta } from "@slock/ui/editor/quill";
import { render } from "@solidjs/web";
import type { ComposerProps } from "../../../../packages/plugins/src/composer/client/composerTypes";
import {
  type DeltaOp,
  mrkdwnText,
} from "../../../../packages/plugins/src/composer/client/lib/deltaLines";
import { buildRichTextBlocks } from "../../../../packages/plugins/src/composer/client/lib/richTextBuild";
import Composer from "../../../../packages/plugins/src/composer/client/views/Composer";
import { createFakeEnv } from "../../../support/core";
import { fakeDraftServer } from "../../drafts/client/fakeDraftServer";
import { composerServices, type Outbox, type SentMessage } from "./composerServices";

type Modifiers = { shift?: boolean; mod?: boolean };

export interface ComposerFixture {
  quill: Quill;
  sent: SentMessage[];
  server: Awaited<ReturnType<typeof fakeDraftServer>>;
  blocks(): Block[];
  copy(): DataTransfer;
  cut(): DataTransfer;
  dispose(): void;
  failNextSend(): void;
  fill(ops: readonly DeltaOp[]): void;
  mrkdwn(): string;
  paste(data: DataTransfer): void;
  press(key: string, modifiers?: Modifiers): KeyboardEvent;
  select(index: number, length?: number): void;
  selectAll(): void;
  send(): Promise<SentMessage>;
  type(text: string): void;
}

const outbox: Outbox = { failNext: false, sent: [] };

export const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

let hostEnv = createFakeEnv();

export async function bootComposerHost() {
  hostEnv = createFakeEnv();
  const host = createHost({ env: hostEnv, reactive: solidReactive });
  setHost(host);
  await host.register(...composerServices(outbox));
}

function findQuill(host: HTMLElement): Quill {
  const container = host.querySelector(".ql-editor-root");
  const found = container && Quill.find(container);
  if (!(found instanceof Quill)) throw new Error("composer did not mount an editor");
  return found;
}

export async function mountComposer(
  props: Partial<ComposerProps> = {},
  View = Composer,
): Promise<ComposerFixture> {
  outbox.sent.length = 0;
  const server = await fakeDraftServer([], hostEnv);
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = render(() => <View channelId={parseChannelId("C1")} {...props} />, host);
  await settle();
  const quill = findQuill(host);
  quill.focus();

  const dispatchClipboard = (type: "copy" | "cut" | "paste", data = new DataTransfer()) => {
    quill.root.dispatchEvent(
      new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData: data }),
    );
    return data;
  };

  const press = (key: string, modifiers: Modifiers = {}) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: modifiers.mod,
      key,
      shiftKey: modifiers.shift,
    });
    quill.root.dispatchEvent(event);
    return event;
  };

  return {
    blocks: () => buildRichTextBlocks(quill.getContents().ops),
    copy: () => dispatchClipboard("copy"),
    cut: () => dispatchClipboard("cut"),
    dispose() {
      dispose();
      server.restore();
      host.remove();
    },
    failNextSend() {
      outbox.failNext = true;
    },
    fill(ops) {
      quill.setContents(new Delta(ops.length ? [...ops] : [{ insert: "\n" }]), "api");
      quill.history.clear();
      quill.setSelection(quill.getLength() - 1, 0, "silent");
    },
    mrkdwn: () => mrkdwnText(quill.getContents().ops),
    paste: (data) => {
      dispatchClipboard("paste", data);
    },
    press,
    quill,
    select: (index, length = 0) => quill.setSelection(index, length, "user"),
    selectAll: () => quill.setSelection(0, quill.getLength() - 1, "user"),
    async send() {
      const before = outbox.sent.length;
      press("Enter");
      await settle();
      const message = outbox.sent[before];
      if (!message) throw new Error("nothing was sent");
      return message;
    },
    sent: outbox.sent,
    server,
    type(text) {
      for (const char of text) {
        if (press(char).defaultPrevented) continue;
        const range = quill.getSelection(true);
        const caret = range.index + char.length;
        const moveCaret = (event: string) => {
          if (event === "text-change") quill.setSelection(caret, 0, "silent");
        };
        quill.on("editor-change", moveCaret);
        quill.updateContents(
          new Delta().retain(range.index).delete(range.length).insert(char),
          "user",
        );
        quill.off("editor-change", moveCaret);
      }
    },
  };
}
