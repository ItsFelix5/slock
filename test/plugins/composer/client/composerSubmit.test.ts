import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { parseChannelId } from "@slock/slack";
import { createRoot } from "solid-js";
import { createComposerSubmitHandler } from "../../../../packages/plugins/src/composer/client/composerSubmit";
import {
  createPendingFileState,
  createPendingFilesStore,
} from "../../../../packages/plugins/src/composer/client/lib/pendingFiles";
import { partialService } from "../../../support/core";

const sent: string[] = [];
const postedDrafts: unknown[] = [];
const cleared: (string | undefined)[] = [];

beforeAll(async () => {
  const host = createHost({ reactive: solidReactive });
  setHost(host);
  await host.register(
    {
      id: "messages",
      setup: (ctx) =>
        ctx.provide(
          "messages",
          partialService<Services["messages"]>({
            sendFiles: () => Promise.resolve(),
            sendMessage: (_channel, text, _unfurl, _thread, _blocks, _files, draft) => {
              postedDrafts.push(draft);
              sent.push(text);
              return Promise.resolve();
            },
          }),
        ),
    },
    {
      id: "composer",
      setup: (ctx) =>
        ctx.provide("composer", {
          pendingFiles: createPendingFilesStore(),
          uploadOnAttach: () => false,
        }),
    },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide("feedback", partialService<Services["feedback"]>({ flash: () => {} })),
    },
    {
      id: "slash-commands",
      setup: (ctx) =>
        ctx.provide(
          "slash-commands",
          partialService<Services["slash-commands"]>({
            handleSlashCommand: () => Promise.resolve({ handled: false, succeeded: false }),
          }),
        ),
    },
  );
});

beforeEach(() => {
  sent.length = 0;
  cleared.length = 0;
  postedDrafts.length = 0;
});

function mountHandler() {
  let text = "hello\n";
  let releasePreviews = () => {};
  const previewsDone = new Promise<void>((resolve) => {
    releasePreviews = resolve;
  });
  const quill = {
    getContents: () => ({ ops: [{ insert: text }] }),
    setContents: () => {},
    setText: (next: string) => {
      text = next;
    },
  };
  const pendingFiles = createRoot(() =>
    createPendingFileState({
      disabled: () => false,
      draftKey: () => "C1",
      store: createPendingFilesStore(),
      uploadOnAttach: () => false,
    }),
  );
  const handler = createComposerSubmitHandler({
    channelId: () => parseChannelId("C1"),
    clearDraftAfterSend: (postedDraftId) => {
      cleared.push(postedDraftId);
      return Promise.resolve();
    },
    discardDraft: () => Promise.resolve(),
    draft: () => ({ clientMsgId: "cm1", id: "D1" }),
    editing: () => undefined,
    existingFiles: () => [],
    feedbackKey: () => "k",
    getQuill: () => quill,
    linkPreviews: {
      hasLinks: () => false,
      reset: () => {},
      urlsToSend: async () => {
        await previewsDone;
        return [];
      },
    },
    onSent: () => {},
    pendingFiles,
    removedAttachmentIds: () => [],
    replyTo: () => undefined,
    sending: () => false,
    setExistingFiles: () => {},
    setSending: () => {},
    threadTs: () => undefined,
  });
  return { handler, releasePreviews };
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

describe("pressing Enter twice while link previews load", () => {
  test("sends the message once", async () => {
    const { handler, releasePreviews } = mountHandler();
    const first = handler();
    const second = handler();
    releasePreviews();
    await Promise.all([first, second]);
    await settle();
    expect(sent).toEqual(["hello"]);
    expect(cleared).toEqual(["D1"]);
    expect(postedDrafts).toEqual([{ clientMsgId: "cm1", id: "D1" }]);
  });

  test("the next message sends after the first finished", async () => {
    const { handler, releasePreviews } = mountHandler();
    releasePreviews();
    await handler();
    await settle();
    expect(sent).toEqual(["hello"]);
    await handler();
    await settle();
    expect(sent).toEqual(["hello"]);
  });
});
