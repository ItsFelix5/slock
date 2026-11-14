import { service } from "@slock/core/solid";
import type { Attachment, Message } from "@slock/types";
import { createSignal, For, Show } from "solid-js";
import { deleteAttachment } from "../../../slack/client/api";
import RemovableAttachment from "../api/RemovableAttachment";
import AttachmentCard from "./AttachmentCard";

const usersStore = service("users");

export default function MessageAttachmentList(props: {
  attachments?: Attachment[];
  channelId: string;
  msg: Message;
}) {
  const [removed, setRemoved] = createSignal<ReadonlySet<number>>(new Set());
  const isOwn = () =>
    !(props.msg.pending || props.msg.botId) && props.msg.userId === usersStore.currentUser()?.id;
  const removeHandler = (a: Attachment) => {
    const { id } = a;
    if (id === undefined || !isOwn()) return;
    return async () => {
      await deleteAttachment(props.channelId, props.msg.ts, id);
      setRemoved((ids) => new Set(ids).add(id));
    };
  };
  return (
    <Show when={props.attachments?.length}>
      <For each={props.attachments}>
        {(a) => (
          <Show when={a.id === undefined || !removed().has(a.id)}>
            <RemovableAttachment onRemove={removeHandler(a)}>
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
                  !!a.fromUrl &&
                  !props.msg.text.includes(a.fromUrl) &&
                  !a.pretext?.includes(a.fromUrl)
                }
                isEphemeral={props.msg.isEphemeral ?? false}
              />
            </RemovableAttachment>
          </Show>
        )}
      </For>
    </Show>
  );
}
