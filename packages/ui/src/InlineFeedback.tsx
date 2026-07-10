import { Show } from "solid-js";
import type { Feedback } from "./keyedFeedback";
import "./InlineFeedback.css";

export interface InlineFeedbackProps {
  feedback: Feedback | undefined;
  class?: string;
}

export default function InlineFeedback(props: InlineFeedbackProps) {
  return (
    <Show when={props.feedback}>
      {(f) => (
        <span class={`inline-feedback inline-feedback-${f().kind} ${props.class ?? ""}`}>
          {f().text}
        </span>
      )}
    </Show>
  );
}
