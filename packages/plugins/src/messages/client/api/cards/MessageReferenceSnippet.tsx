import { BlockKit, TimeAnchorContext } from "@slock/blockkit";
import type { Block, SlackFile } from "@slock/types";
import { Show } from "solid-js";
import TextOrFiles from "../../../../files/client/api/TextOrFiles";

export default function MessageReferenceSnippet(props: {
  blocks?: Block[];
  botId?: string;
  botUserId?: string;
  channelId: string;
  edited?: boolean;
  files?: SlackFile[];
  inline?: boolean;
  text: string;
  threadTs?: string;
  ts: string;
  tz?: string;
}) {
  const blocks = () => (props.blocks?.length ? props.blocks : undefined);

  return (
    <TimeAnchorContext value={{ ms: parseFloat(props.ts) * 1000, tz: props.tz }}>
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
