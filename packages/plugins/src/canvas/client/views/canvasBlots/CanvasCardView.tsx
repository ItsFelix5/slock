import { safeUrl } from "@slock/blockkit";
import MessageAttachmentList from "@slock/plugins/message-media/client/api/MessageAttachmentList";
import type { CanvasCard } from "@slock/types";
import { Show } from "solid-js";
import { createCanvasCardQuery } from "../../lib/canvasRequests";

export default function CanvasCardView(props: { card: CanvasCard }) {
  const message = createCanvasCardQuery(() => props.card);
  const unfurled = () => {
    const loaded = message().data;
    return loaded?.attachments?.length ? loaded : undefined;
  };
  return (
    <Show
      fallback={
        <a href={safeUrl(props.card.url)} rel="noopener noreferrer" target="_blank">
          {props.card.url}
        </a>
      }
      when={unfurled()}
    >
      {(loaded) => (
        <MessageAttachmentList
          attachments={loaded().attachments}
          channelId={props.card.channelId}
          msg={loaded()}
        />
      )}
    </Show>
  );
}
