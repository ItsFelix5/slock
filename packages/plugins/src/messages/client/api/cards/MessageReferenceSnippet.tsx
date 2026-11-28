import { BlockKit, TimeAnchorContext } from "@slock/blockkit";
import type { ChannelId, TeamId, Ts } from "@slock/types";
import { Show } from "solid-js";
import MessagePreviewImages from "../preview/MessagePreviewImages";
import MessagePreviewText from "../preview/MessagePreviewText";
import { type PreviewContent, previewBody } from "../preview/previewContent";
import "./MessageEdited.css";

export default function MessageReferenceSnippet(
  props: PreviewContent & {
    botId?: string;
    botTeamId?: TeamId;
    botUserId?: string;
    channelId: ChannelId;
    edited?: boolean;
    inline?: boolean;
    textClass?: string;
    threadTs?: Ts;
    thumbnails?: boolean;
    ts: Ts;
    tz?: string;
  },
) {
  const blocks = () => previewBody(props).blocks;
  const body = () => (
    <Show
      fallback={
        <>
          <MessagePreviewText
            attachments={props.attachments}
            blocks={props.blocks}
            files={props.files}
            inline={props.inline}
            text={props.text}
          />
          <Show when={props.edited}>
            <span class="message-edited" />
          </Show>
        </>
      }
      when={blocks()}
    >
      {(b) => (
        <BlockKit
          blocks={b()}
          context={{
            botId: props.botId,
            botTeamId: props.botTeamId,
            botUserId: props.botUserId,
            channelId: props.channelId,
            messageTs: props.ts,
            threadTs: props.threadTs,
          }}
          inert={props.inline}
          trailing={props.edited ? <span class="message-edited" /> : undefined}
        />
      )}
    </Show>
  );

  return (
    <TimeAnchorContext
      value={{
        get ms() {
          return parseFloat(props.ts) * 1000;
        },
        get tz() {
          return props.tz;
        },
      }}
    >
      <Show fallback={body()} when={props.thumbnails}>
        <div class={props.textClass}>{body()}</div>
        <MessagePreviewImages
          attachments={props.attachments}
          blocks={props.blocks}
          files={props.files}
          text={props.text}
        />
      </Show>
    </TimeAnchorContext>
  );
}
