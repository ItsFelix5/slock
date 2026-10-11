import { service } from "@slock/core/solid";
import { InlineFeedback } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBodyProps } from "../api";

const feedback = service("feedback");

export default function FeedbackBody(props: MessageBodyProps) {
  return (
    <Show when={feedback.get(props.msg.ts)}>
      {(feedback) => (
        <InlineFeedback
          class="message-feedback"
          feedback={feedback()}
          priority={props.threadTs ? 1 : 0}
          variant="icon"
        />
      )}
    </Show>
  );
}
