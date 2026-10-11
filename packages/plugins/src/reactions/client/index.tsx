import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { Show } from "solid-js";
import type { MessageBodyProps } from "../../messages/client/api";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import ReactionRow from "./api/ReactionRow";
import ReactButton from "./views/ReactButton";

const setup: Setup = (ctx) => {
  const messages = service("messages");

  function ReactionsBody(props: MessageBodyProps) {
    return (
      <Show when={props.msg.reactions?.length ? props.msg.reactions : undefined}>
        {(reactions) => (
          <ReactionRow
            allowAdd
            feedbackKey={props.msg.ts}
            isPending={(name) => messages.isReactionPending(props.channelId, props.msg.ts, name)}
            onToggle={(name) => messages.reactToMessage(props.channelId, props.msg, name)}
            reactions={reactions()}
          />
        )}
      </Show>
    );
  }

  ctx.add("messages.bar", liveOnly(ReactButton), { order: 10 });
  ctx.add("messages.body", liveOnly(ReactionsBody), { order: 20 });
};

export default setup;
