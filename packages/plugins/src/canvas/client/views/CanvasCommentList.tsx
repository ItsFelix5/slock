import type { CanvasAccess, CanvasCommentThread, FileId } from "@slock/types";
import { For, Show } from "solid-js";
import { annotationQuote } from "../../protocol/api";
import type { CanvasCommentsController } from "../lib/canvasComments";
import type { CanvasDocModel } from "../lib/canvasDelta";
import CanvasCommentItem from "./CanvasCommentItem";
import CanvasSidePanel from "./CanvasSidePanel";
import "./CanvasCommentList.css";

const SECTIONS = [
  { archived: false, title: "Open" },
  { archived: true, title: "Resolved" },
];

export default function CanvasCommentList(props: {
  access: CanvasAccess;
  anchor: () => HTMLElement | undefined;
  comments: CanvasCommentsController;
  doc: CanvasDocModel;
  fileId: FileId;
  onClose: () => void;
  onReveal: (threadId: string) => void;
}) {
  const quoteOf = (threadId: string) =>
    annotationQuote(props.doc.nodes, props.doc.embeds, threadId);

  function open(thread: CanvasCommentThread) {
    props.onReveal(thread.threadId);
    props.comments.openThread(thread);
  }

  return (
    <CanvasSidePanel
      anchor={props.anchor}
      label="Comments"
      onClose={props.onClose}
      title="Comments"
    >
      <For each={SECTIONS}>
        {(section) => {
          const threads = () =>
            props.comments.started().filter((thread) => thread.archived === section.archived);
          return (
            <Show when={threads().length > 0}>
              <section>
                <h3 class="canvas-side-heading text-dim">{section.title}</h3>
                <ol class="canvas-side-list">
                  <For each={threads()} keyed={(thread) => thread.ts}>
                    {(thread) => (
                      <CanvasCommentItem
                        access={props.access}
                        comments={props.comments}
                        fileId={props.fileId}
                        onOpen={() => open(thread())}
                        quote={quoteOf(thread().threadId)}
                        thread={thread()}
                      />
                    )}
                  </For>
                </ol>
              </section>
            </Show>
          );
        }}
      </For>
      <Show when={props.comments.started().length === 0}>
        <div class="canvas-side-note text-dim" role="status">
          {props.comments.status() === "loading" ? "Loading…" : "No comments"}
        </div>
      </Show>
      <Show when={props.comments.status() === "error"}>
        <div class="canvas-side-note text-dim" role="alert">
          Couldn't load the comments.
        </div>
      </Show>
    </CanvasSidePanel>
  );
}
