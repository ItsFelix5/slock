import { service } from "@slock/core/solid";
import { createMemo } from "solid-js";
import { annotationQuote, canvasHtmlLines } from "../../../canvas/client/api/canvasQuote";
import "./CommentQuote.css";

const canvasStore = service("canvas");

export default function CommentQuote(props: { fileId: string; threadId: string }) {
  const content = canvasStore.createCanvasContentQuery(() => props.fileId);
  const quote = createMemo(() =>
    annotationQuote(canvasHtmlLines(content.data?.doc), props.threadId),
  );

  return (
    <button
      class="canvas-comment-quote btn-reset"
      onClick={() => canvasStore.openCanvasPane(props.fileId)}
      type="button"
    >
      {quote() ?? "Commented text"}
    </button>
  );
}
