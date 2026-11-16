import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import type { SlackFile } from "@slock/types";
import { createRoot } from "solid-js";
import { createComposerSubmitHandler } from "../../../src/composer/client/composerSubmit";
import { createPendingFileState } from "../../../src/composer/client/lib/pendingFiles";

const sent: string[] = [];
const fileSends: { comment?: string; files: string[] }[] = [];
const flashes: string[] = [];
let cleared = 0;

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
            sendFiles: (_channel, files, _threadTs, comment) => {
              fileSends.push({ comment, files: files.map((file) => file.name) });
              return Promise.resolve();
            },
            sendMessage: (_channel, text) => {
              sent.push(text);
              return Promise.resolve();
            },
          }),
        ),
    },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({
            flash: (_key, message) => {
              flashes.push(message);
            },
          }),
        ),
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
  fileSends.length = 0;
  flashes.length = 0;
  cleared = 0;
});

type Editing = NonNullable<
  ReturnType<Parameters<typeof createComposerSubmitHandler>[0]["editing"]>
>;

function mountHandler(
  options: {
    draftKey?: string;
    editing?: Editing;
    existing?: SlackFile[];
    files?: File[];
    text?: string;
  } = {},
) {
  let text = options.text ?? "hello\n";
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
    createPendingFileState({ disabled: () => false, draftKey: () => options.draftKey ?? "C1" }),
  );
  if (options.files) pendingFiles.add(options.files);
  const handler = createComposerSubmitHandler({
    channelId: () => "C1",
    clearDraftAfterSend: () => {
      cleared += 1;
      return Promise.resolve();
    },
    editing: () => options.editing,
    existingFiles: () => options.existing ?? [],
    feedbackKey: () => "k",
    getQuill: () => quill,
    linkPreviews: {
      reset: () => {},
      urlsToSend: async () => {
        await previewsDone;
        return [];
      },
    },
    onSent: () => {},
    pendingFiles,
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
    expect(cleared).toBe(1);
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

describe("attaching files to a message that pings the channel", () => {
  test("sends them instead of refusing", async () => {
    const { handler, releasePreviews } = mountHandler({
      draftKey: "C-channel-files",
      files: [new File(["a"], "a.png")],
      text: "<!channel> look\n",
    });
    releasePreviews();
    await handler();
    await settle();
    expect(flashes).toEqual([]);
    expect(fileSends).toEqual([{ comment: "<!channel> look", files: ["a.png"] }]);
  });
});

describe("saving an edit", () => {
  const kept: SlackFile = { id: "F1", isImage: false, name: "kept.txt", urlPrivate: "u" };

  test("hands over the files to keep and the newly attached ones", async () => {
    const saved: { fileIds?: string[]; files?: string[]; text: string }[] = [];
    const { handler } = mountHandler({
      draftKey: "C-edit",
      editing: {
        onCancel: () => {},
        onSave: (text, _blocks, fileIds, files) => {
          saved.push({ fileIds, files: files?.map((file) => file.name), text });
          return Promise.resolve(true);
        },
      },
      existing: [kept],
      files: [new File(["a"], "new.png")],
      text: "edited\n",
    });
    await handler();
    expect(saved).toEqual([{ fileIds: ["F1"], files: ["new.png"], text: "edited" }]);
  });
});
