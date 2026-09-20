import { BlockKit, Mrkdwn, TimeAnchorContext } from "@slock/blockkit";
import { Show } from "solid-js";
import type { Block } from "../../../lib/api";

export default function MessageReferenceSnippet(props: {
  blocks?: Block[];
  botId?: string;
  botUserId?: string;
  channelId: string;
  edited?: boolean;
  text: string;
  threadTs?: string;
  ts: string;
  tz?: string;
}) {
  const blocks = () => (props.blocks?.length ? props.blocks : undefined);

  return (
    <TimeAnchorContext.Provider value={{ ms: parseFloat(props.ts) * 1000, tz: props.tz }}>
      <Show
        fallback={
          <>
            <Mrkdwn text={props.text} />
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
            trailing={props.edited ? <span class="message-edited"> (edited)</span> : undefined}
          />
        )}
      </Show>
    </TimeAnchorContext.Provider>
  );
}
