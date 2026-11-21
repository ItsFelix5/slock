import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import type { MessageBodyProps } from "@slock/plugins/messages/client/api";
import { liveOnly } from "@slock/plugins/messages/client/api/deletedMessages";
import { Show } from "solid-js";
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
