import { BkText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { getCachedWorkspaceDomain } from "@slock/slack/client";
import type { FileId } from "@slock/types";
import { Icon } from "@slock/ui";
import { createMemo } from "solid-js";
import { annotationQuote, quoteMrkdwn } from "../../protocol/api";
import "./CommentQuote.css";

const canvas = service("canvas");

export default function CommentQuote(props: { fileId: FileId; text: string; threadId: string }) {
  const title = () => canvas.canvasTitle(props.fileId) ?? "Canvas";
  const quote = createMemo(() => {
    const doc = canvas.peekCanvasContent(props.fileId)?.doc;
    const found = doc && annotationQuote(doc.nodes, doc.embeds, props.threadId);
    return found ? quoteMrkdwn(found, getCachedWorkspaceDomain()) : props.text;
  });

  return (
    <div class="canvas-comment-quote">
      <button
        class="canvas-comment-quote-source btn-reset flex-align-center"
        onClick={() => canvas.openCanvasPane(props.fileId)}
        type="button"
      >
        <Icon name="canvas" size={14} />
        <span class="truncate">{title()}</span>
      </button>
      <BkText class="message-text" text={{ text: quote(), type: "mrkdwn" }} />
    </div>
  );
}
