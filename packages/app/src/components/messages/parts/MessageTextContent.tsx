import { BlockKit, Mrkdwn, TimeAnchorContext } from "@slock/blockkit";
import { Show } from "solid-js";
import type { Message } from "../../../lib/api";
import { store } from "../../../lib/store";
import Composer from "../../composer/Composer";
import type { MessageRenderState } from "./messageRenderState";

export default function MessageTextContent(props: {
  channelId: string;
  hasEnlargedEmojiOnlyText: boolean;
  isEditing: boolean;
  messageText: string;
  msg: Message;
  onStopEdit?: () => void;
  renderBlocks: MessageRenderState["renderBlocks"];
  replyRef: MessageRenderState["replyRef"];
  tz: string | undefined;
}) {
  return (
    <Show
      fallback={
        <Composer
          channelId={props.channelId}
          editing={{
            initialBlocks: props.replyRef ? undefined : props.msg.blocks,
            initialText: props.replyRef?.rest ?? props.msg.text,
            onCancel: () => props.onStopEdit?.(),
            onSave: async (text, blocks) => {
              const saved = await store.messages.editMessageText(
                props.channelId,
                props.msg.ts,
                (props.replyRef?.prefix ?? "") + text,
                blocks,
              );
              if (saved) props.onStopEdit?.();
              return saved;
            },
          }}
        />
      }
      when={!props.isEditing}
    >
      <div
        class={`message-text${props.msg.deleted ? " message-deleted-text" : ""}`}
        classList={{ "message-emoji-only": props.hasEnlargedEmojiOnlyText }}
      >
        <TimeAnchorContext.Provider value={{ ms: parseFloat(props.msg.ts) * 1000, tz: props.tz }}>
          <Show
            fallback={
              <>
                <Mrkdwn text={props.messageText} />
                <Show when={props.msg.edited}>
                  <span class="message-edited"> (edited)</span>
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
                trailing={
                  props.msg.edited ? <span class="message-edited"> (edited)</span> : undefined
                }
              />
            )}
          </Show>
        </TimeAnchorContext.Provider>
      </div>
    </Show>
  );
}
