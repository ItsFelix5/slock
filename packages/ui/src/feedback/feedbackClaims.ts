import type { Feedback } from "./keyedFeedback";

interface FeedbackClaim {
  priority: number;
  select: (selected: boolean) => void;
}

const claimsByFeedback = new WeakMap<Feedback, Map<symbol, FeedbackClaim>>();

function winningOwner(claims: Map<symbol, FeedbackClaim>): symbol | undefined {
  let winner: [symbol, FeedbackClaim] | undefined;
  for (const entry of claims) {
    if (!winner || entry[1].priority > winner[1].priority) winner = entry;
  }
  return winner?.[0];
}

function updateClaims(claims: Map<symbol, FeedbackClaim>) {
  const winner = winningOwner(claims);
  for (const [owner, claim] of claims) claim.select(owner === winner);
}

export function claimFeedback(
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
  claims.set(owner, { priority, select });
  updateClaims(claims);

  return () => {
    claims.delete(owner);
    select(false);
    if (claims.size) updateClaims(claims);
    else claimsByFeedback.delete(feedback);
  };
}
