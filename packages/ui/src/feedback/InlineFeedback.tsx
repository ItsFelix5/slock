import { createEffect, createSignal, Show } from "solid-js";
import Icon from "../media/Icon";
import Tooltip from "../overlay/Tooltip";
import { claimFeedback } from "./feedbackClaims";
import type { Feedback } from "./keyedFeedback";
import "./InlineFeedback.css";

interface InlineFeedbackProps {
  class?: string;
  feedback: Feedback | undefined;
  priority?: number;
  variant?: "text" | "icon";
}

export default function InlineFeedback(props: InlineFeedbackProps) {
  const owner = Symbol("inline-feedback");
  const [visibleFeedback, setVisibleFeedback] = createSignal<Feedback | undefined>(undefined, {
    ownedWrite: true,
  });

  createEffect(
    () => ({ feedback: props.feedback, priority: props.priority ?? 0 }),
    ({ feedback, priority }) => {
      if (!feedback) return;
      return claimFeedback(feedback, owner, priority, (selected) => {
        setVisibleFeedback(selected ? feedback : undefined);
      });
    },
  );

  return (
    <Show when={visibleFeedback()}>
      {(f) => (
        <Show
          fallback={
            <span
              class={`inline-feedback inline-feedback-${f().kind} ${props.class ?? ""}`}
              role={f().kind === "error" ? "alert" : "status"}
            >
              {f().text}
            </span>
          }
          when={props.variant === "icon"}
        >
          <Tooltip content={f().text}>
            <span
              class={`inline-feedback inline-feedback-icon inline-feedback-${f().kind} ${props.class ?? ""}`}
              role={f().kind === "error" ? "alert" : "status"}
            >
              <Icon
                name={f().kind === "error" ? "warning-filled" : "check-circle-filled"}
                size={14}
              />
            </span>
          </Tooltip>
        </Show>
      )}
    </Show>
  );
}
