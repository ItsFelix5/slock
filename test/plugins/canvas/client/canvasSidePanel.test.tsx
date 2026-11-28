import { afterEach, beforeAll, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import type { CanvasCommentsController } from "../../../../packages/plugins/src/canvas/client/lib/canvasComments";
import CanvasCommentList from "../../../../packages/plugins/src/canvas/client/views/CanvasCommentList";
import CanvasHistory from "../../../../packages/plugins/src/canvas/client/views/CanvasHistory";
import { useCanvasPanels } from "../../../../packages/plugins/src/canvas/client/views/useCanvasPanels";
import type { CanvasCommentThread, CanvasVersion } from "../../../../packages/types/src";
import { fid, stamp, uid } from "../../../support/slack";
import { bootComposerHost, settle } from "../../composer/client/composerHarness";

beforeAll(bootComposerHost);

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.replaceChildren();
});

const thread = (ts: string): CanvasCommentThread => ({
  archived: false,
  quote: ts,
  reactions: [],
  replyCount: 1,
  threadId: `temp:C:${ts}`,
  ts: stamp(ts),
});

const focusedText = () => document.activeElement?.textContent;

function focusedRowQuote() {
  return document.activeElement?.closest("li")?.querySelector("span")?.textContent;
}

test("resolving from the keyboard moves on to the next comment", async () => {
  const [threads, setThreads] = createSignal([thread("1"), thread("2")]);
  const comments: CanvasCommentsController = {
    markedIds: () => [],
    openAnnotation: () => {},
    openThread: () => {},
    reactToAnnotation: () => {},
    reactToThread: () => {},
    resolve: ({ ts }, archived) =>
      void setThreads((all) =>
        all.map((entry) => (entry.ts === ts ? { ...entry, archived } : entry)),
      ),
    resolving: () => false,
    started: threads,
    status: () => "ready",
  };
  const host = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <CanvasCommentList
        access="edit"
        anchor={() => undefined}
        comments={comments}
        doc={{
          embeds: new Map(),
          fileIds: [],
          meta: { documentId: "", shardChars: "", threadId: "" },
          nodes: [],
          title: "",
        }}
        fileId={fid("F1")}
        onClose={() => {}}
        onReveal={() => {}}
      />
    ),
    host,
  );
  await settle();
  expect(focusedRowQuote()).toBe("1");

  const resolve = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Resolve",
  );
  resolve?.focus();
  resolve?.click();
  flush();
  await settle();

  expect(focusedText()).toBe("Resolve");
  expect(focusedRowQuote()).toBe("2");
});

test("history takes focus once its versions arrive and keeps it across refreshes", async () => {
  const [versions, setVersions] = createSignal<CanvasVersion[]>([]);
  const version = (versionId: string): CanvasVersion => ({
    authorId: uid("U1"),
    commentOnly: false,
    createdMs: Date.now(),
    sequence: 1,
    versionId,
  });
  const host = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <CanvasHistory
        anchor={() => undefined}
        error={false}
        loading={versions().length === 0}
        onClose={() => {}}
        onSelect={() => {}}
        selected={null}
        versions={versions()}
      />
    ),
    host,
  );
  await settle();
  setVersions([version("b"), version("a")]);
  flush();
  await settle();
  const latest = host.querySelector("[aria-pressed='true']");
  expect(document.activeElement).toBe(latest);

  setVersions([version("c"), version("b"), version("a")]);
  flush();
  await settle();
  expect(document.activeElement).toBe(latest);
});

test("the panels open while the caret is in the canvas", async () => {
  let history = false;
  let commentsOpen = () => false;
  const typing = document.body.appendChild(document.createElement("textarea"));
  dispose = render(
    () => {
      ({ commentsOpen } = useCanvasPanels({
        fileId: () => fid("F1"),
        focused: () => true,
        history: {
          open: () => history,
          setOpen: (open) => {
            history = open;
          },
        },
      }));
      return null;
    },
    document.body.appendChild(document.createElement("div")),
  );
  await settle();

  const press = (key: string) =>
    typing.dispatchEvent(
      new KeyboardEvent("keydown", { altKey: true, bubbles: true, ctrlKey: true, key }),
    );
  press("c");
  flush();
  expect(commentsOpen()).toBe(true);

  press("h");
  flush();
  expect([commentsOpen(), history]).toEqual([false, true]);
});
