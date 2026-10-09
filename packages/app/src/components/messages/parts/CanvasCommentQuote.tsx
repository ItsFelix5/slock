import { createMemo } from "solid-js";
import { annotationQuote, canvasHtmlLines } from "../../../lib/canvas/canvasQuote";
import { store } from "../../../lib/store";
import "./CanvasCommentQuote.css";

export default function CanvasCommentQuote(props: { fileId: string; threadId: string }) {
  const content = store.canvas.createCanvasContentQuery(() => props.fileId);
  const quote = createMemo(() =>
    annotationQuote(canvasHtmlLines(content.data?.doc), props.threadId),
  );

  return (
    <button
      class="canvas-comment-quote btn-reset"
      onClick={() => store.canvas.openCanvasPane(props.fileId)}
      type="button"
    >
      {quote() ?? "Commented text"}
    </button>
  );
}
