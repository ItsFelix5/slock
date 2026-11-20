import { service } from "@slock/core/solid";
import type { FileId } from "@slock/types";
import { Icon } from "@slock/ui";
import { createMemo } from "solid-js";
import { annotationQuote, canvasHtmlLines } from "../../../canvas/client/api/canvasQuote";
import "./CommentQuote.css";

const canvasStore = service("canvas");

export default function CommentQuote(props: { fileId: FileId; text: string; threadId: string }) {
  const content = canvasStore.createCanvasContentQuery(() => props.fileId);
  const title = () => canvasStore.canvasTitle(props.fileId) ?? "Canvas";
  const quote = createMemo(
    () => annotationQuote(canvasHtmlLines(content().data?.doc), props.threadId) ?? props.text,
  );

  return (
    <button
      class="canvas-comment-quote btn-reset"
      onClick={() => canvasStore.openCanvasPane(props.fileId, title())}
      type="button"
    >
      <span class="canvas-comment-quote-source flex-align-center">
        <Icon name="canvas" size={14} />
        <span class="truncate">{title()}</span>
      </span>
      <span class="canvas-comment-quote-text">{quote()}</span>
    </button>
  );
}
