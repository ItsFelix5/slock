export type ChannelPlacementOutcome = "failed" | "applied" | "applied-with-warning";

export function isChannelPlacementApplied(outcome: ChannelPlacementOutcome): boolean {
  return outcome !== "failed";
}
