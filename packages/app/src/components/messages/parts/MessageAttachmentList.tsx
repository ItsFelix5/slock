import type { Attachment, Message } from "@slock/slack-api";
import { For, Show } from "solid-js";
import AttachmentCard from "./media/AttachmentCard";

export default function MessageAttachmentList(props: {
  attachments?: Attachment[];
  channelId: string;
  msg: Message;
}) {
  return (
    <Show when={props.attachments?.length}>
      <For each={props.attachments}>
        {(a) => (
          <AttachmentCard
            attachment={a}
            context={{
              botId: props.msg.botId,
              botUserId: props.msg.userId,
              channelId: props.channelId,
              messageTs: props.msg.ts,
              threadTs: props.msg.threadTs,
            }}
            showPermalink={
              !!a.fromUrl && !props.msg.text.includes(a.fromUrl) && !a.pretext?.includes(a.fromUrl)
            }
            isEphemeral={props.msg.isEphemeral ?? false}
          />
        )}
      </For>
    </Show>
  );
}
