import { BlockKit, TimeAnchorContext } from "@slock/blockkit";
import TextOrFiles from "@slock/plugins/files/client/api/TextOrFiles";
import type { Block, ChannelId, SlackFile, Ts } from "@slock/types";
import { Show } from "solid-js";

export default function MessageReferenceSnippet(props: {
  blocks?: Block[];
  botId?: string;
  botUserId?: string;
  channelId: ChannelId;
  edited?: boolean;
  files?: SlackFile[];
  inline?: boolean;
  text: string;
  threadTs?: Ts;
  ts: Ts;
  tz?: string;
}) {
  const blocks = () => (props.blocks?.length ? props.blocks : undefined);

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
      <Show
        fallback={
          <>
            <TextOrFiles files={props.files} inline={props.inline} text={props.text} />
            <Show when={props.edited}>
              <span class="message-edited"> (edited)</span>
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
              botUserId: props.botUserId,
              channelId: props.channelId,
              messageTs: props.ts,
              threadTs: props.threadTs,
            }}
            inert={props.inline}
            trailing={props.edited ? <span class="message-edited"> (edited)</span> : undefined}
          />
        )}
      </Show>
    </TimeAnchorContext>
  );
}
