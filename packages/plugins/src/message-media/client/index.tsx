import type { Setup } from "@slock/core";
import { Show } from "solid-js";
import type { MessageBodyProps } from "../../messages/client/api";
import MessageFiles from "./api/MessageFiles";
import MessageAttachmentList from "./views/MessageAttachmentList";
import PendingFiles from "./views/PendingFiles";

function MediaBody(props: MessageBodyProps) {
  return (
    <>
      <Show when={!props.isEditing && props.msg.files?.length ? props.msg.files : undefined}>
        {(files) => <MessageFiles files={files()} />}
      </Show>
      <Show when={props.msg.pendingFiles?.length ? props.msg.pendingFiles : undefined}>
        {(files) => <PendingFiles files={files()} />}
      </Show>
      <MessageAttachmentList
        attachments={props.attachments}
        channelId={props.channelId}
        msg={props.msg}
      />
    </>
  );
}

const setup: Setup = (ctx) => {
  ctx.add("messages.body", MediaBody, { order: 10 });
};

export default setup;
