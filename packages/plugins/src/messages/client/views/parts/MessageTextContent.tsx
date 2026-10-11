import {
  BlockKit,
  HighlightWordsContext,
  MessageAttachmentsContext,
  Mrkdwn,
  TimeAnchorContext,
} from "@slock/blockkit";
import { Slot, service, usePoint } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { createMemo, Show } from "solid-js";
import type { MessageContent } from "../../lib/messageRenderState";
import EditedLabel from "./EditedLabel";

const messagesStore = service("messages");
const prefsStore = service("prefs");

export default function MessageTextContent(props: {
  channelId: string;
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
            initialBlocks: props.replyRef ? undefined : props.msg.blocks,
            initialFiles: props.replyRef ? undefined : props.msg.files,
            initialText: props.replyRef?.rest ?? props.msg.text,
            onCancel: () => props.onStopEdit?.(),
            onSave: async (text, blocks, fileIds) => {
              const saved = await messagesStore.editMessageText(
                props.channelId,
                props.msg.ts,
                (props.replyRef?.prefix ?? "") + text,
                blocks,
                fileIds,
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
              <HighlightWordsContext.Provider value={prefsStore.highlightWords}>
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
              </HighlightWordsContext.Provider>
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
