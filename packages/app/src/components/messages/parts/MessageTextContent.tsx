import {
  BlockKit,
  HighlightWordsContext,
  MessageAttachmentsContext,
  Mrkdwn,
  TimeAnchorContext,
} from "@slock/blockkit";
import type { Message } from "@slock/types";
import { Show } from "solid-js";
import { store } from "../../../lib/store";
import Composer from "../../composer/Composer";
import CanvasCommentQuote from "./CanvasCommentQuote";
import EditedLabel from "./EditedLabel";
import type { MessageContent } from "./messageRenderState";

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
  const hostedFileId = () =>
    props.msg.canvasThreadId
      ? store.channels.channelById(props.channelId)?.canvasFileId
      : undefined;

  return (
    <Show
      fallback={
        <Composer
          channelId={props.channelId}
          editing={{
            initialBlocks: props.replyRef ? undefined : props.msg.blocks,
            initialFiles: props.replyRef ? undefined : props.msg.files,
            initialText: props.replyRef?.rest ?? props.msg.text,
            onCancel: () => props.onStopEdit?.(),
            onSave: async (text, blocks, fileIds) => {
              const saved = await store.messages.editMessageText(
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
              <HighlightWordsContext.Provider value={store.preferences.highlightWords}>
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
        keyed
        when={hostedFileId()}
      >
        {(fileId) => (
          <CanvasCommentQuote fileId={fileId} threadId={props.msg.canvasThreadId ?? ""} />
        )}
      </Show>
    </Show>
  );
}
