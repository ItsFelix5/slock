import { BlockKit, MessageAttachmentsContext, Mrkdwn, TimeAnchorContext } from "@slock/blockkit";
import { Slot, service, usePoint } from "@slock/core/solid";
import type { Attachment, ChannelId, Message } from "@slock/types";
import { createMemo, Show } from "solid-js";
import { encodeReplyLink, withReplyLink } from "../../../../message-links/client/api/replyLink";
import type { MessageContent } from "../../lib/messageRenderState";
import { deleteOrDismissMessage } from "../../messageActions";
import EditedLabel from "./EditedLabel";

const messagesStore = service("messages");

export default function MessageTextContent(props: {
  attachments: Attachment[] | undefined;
  channelId: ChannelId;
  hasEnlargedEmojiOnlyText: boolean;
  isEditing: boolean;
  messageText: string;
  msg: Message;
  onStopEdit?: () => void;
  renderBlocks: MessageContent["renderBlocks"];
  replyRef: MessageContent["replyRef"];
  tz: string | undefined;
}) {
  const quotes = usePoint("messages.quote");
  const quote = createMemo(() => {
    for (const item of quotes()) {
      const found = item(props.msg, props.channelId);
      if (found) return found;
    }
  });

  return (
    <Show
      fallback={
        <Slot
          channelId={props.channelId}
          point="composer.input"
          editing={{
            initialAttachments: props.attachments,
            initialBlocks: props.renderBlocks,
            initialFiles: props.replyRef ? undefined : props.msg.files,
            initialText: props.messageText,
            onCancel: () => props.onStopEdit?.(),
            onSave: async (text, blocks, fileIds, removedAttachmentIds) => {
              if (!(text.trim() || fileIds?.length)) {
                const deleted = await deleteOrDismissMessage(props.channelId, props.msg);
                if (deleted) props.onStopEdit?.();
                return deleted;
              }
              const url = props.replyRef?.url;
              const saved = await messagesStore.editMessageText(
                props.channelId,
                props.msg.ts,
                url ? encodeReplyLink(url) + text : text,
                url && blocks ? withReplyLink(blocks, url) : blocks,
                fileIds,
                removedAttachmentIds,
              );
              if (saved) props.onStopEdit?.();
              return saved;
            },
          }}
        />
      }
      when={!props.isEditing}
    >
      <Show
        fallback={
          <Show when={props.messageText || props.renderBlocks}>
            <div
              class={`message-text${props.msg.deleted ? " message-deleted-text" : ""}`}
              classList={{ "message-emoji-only": props.hasEnlargedEmojiOnlyText }}
            >
              <MessageAttachmentsContext.Provider value={() => props.msg.attachments}>
                <TimeAnchorContext.Provider
                  value={{ ms: parseFloat(props.msg.ts) * 1000, tz: props.tz }}
                >
                  <Show
                    fallback={
                      <>
                        <Mrkdwn text={props.messageText} />
                        <Show when={props.msg.edited}>
                          <EditedLabel msg={props.msg} />
                        </Show>
                      </>
                    }
                    when={props.renderBlocks}
                  >
                    {(blocks) => (
                      <BlockKit
                        blocks={blocks()}
                        context={{
                          botId: props.msg.botId,
                          botUserId: props.msg.userId,
                          channelId: props.channelId,
                          messageTs: props.msg.ts,
                          threadTs: props.msg.threadTs,
                        }}
                        trailing={props.msg.edited ? <EditedLabel msg={props.msg} /> : undefined}
                      />
                    )}
                  </Show>
                </TimeAnchorContext.Provider>
              </MessageAttachmentsContext.Provider>
            </div>
          </Show>
        }
        when={quote()}
      >
        {(content) => content()}
      </Show>
    </Show>
  );
}
