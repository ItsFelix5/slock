import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { Feedback } from "./keyedFeedback";
import "./InlineFeedback.css";

export interface InlineFeedbackProps {
  class?: string;
  feedback: Feedback | undefined;
  priority?: number;
}

interface FeedbackClaim {
  order: number;
  priority: number;
  select: (selected: boolean) => void;
}

const claimsByFeedback = new WeakMap<Feedback, Map<symbol, FeedbackClaim>>();
let claimOrder = 0;

function updateClaims(claims: Map<symbol, FeedbackClaim>) {
  let winner: symbol | undefined;
  let winningClaim: FeedbackClaim | undefined;
  for (const [owner, claim] of claims) {
    if (
      !winningClaim ||
      claim.priority > winningClaim.priority ||
      (claim.priority === winningClaim.priority && claim.order < winningClaim.order)
    ) {
      winner = owner;
      winningClaim = claim;
    }
  }
  for (const [owner, claim] of claims) claim.select(owner === winner);
}

function claimFeedback(
  feedback: Feedback,
  owner: symbol,
  priority: number,
  select: (selected: boolean) => void,
) {
  let claims = claimsByFeedback.get(feedback);
  if (!claims) {
    claims = new Map();
    claimsByFeedback.set(feedback, claims);
  }
  claims.set(owner, { order: claimOrder++, priority, select });
  updateClaims(claims);

  return () => {
    claims.delete(owner);
    select(false);
    if (claims.size) updateClaims(claims);
    else claimsByFeedback.delete(feedback);
  };
}

export default function InlineFeedback(props: InlineFeedbackProps) {
  const owner = Symbol("inline-feedback");
  const [visibleFeedback, setVisibleFeedback] = createSignal<Feedback>();

  createEffect(() => {
    const { feedback } = props;
    if (!feedback) {
      setVisibleFeedback(undefined);
      return;
    }
    const release = claimFeedback(feedback, owner, props.priority ?? 0, (selected) => {
      setVisibleFeedback(selected ? feedback : undefined);
    });
    onCleanup(release);
  });

  return (
    <Show when={visibleFeedback()}>
      {(f) => (
        <span class={`inline-feedback inline-feedback-${f().kind} ${props.class ?? ""}`}>
          {f().text}
        </span>
      )}
    </Show>
  );
}
