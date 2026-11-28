import type { ChannelId, Ts } from "@slock/types";

export function channelsNeedingRecentHistory(input: {
  atPresent: (channelId: ChannelId) => boolean;
  previousViewIds: ChannelId[];
  targetChannelIds: ChannelId[];
  viewIds: ChannelId[];
}): ChannelId[] {
  return input.viewIds.filter(
    (id) =>
      !(
        input.previousViewIds.includes(id) ||
        input.targetChannelIds.includes(id) ||
        input.atPresent(id)
      ),
  );
}

type ThreadLoadPlan = { kind: "anchored"; anchor: Ts } | { kind: "initial" } | { kind: "none" };

export function planThreadLoad(input: {
  anchor: Ts | undefined;
  anchorAttempted: Ts | undefined;
  anchorCovered: boolean;
  hasError: boolean;
  hasPaging: boolean;
  ts: Ts;
}): ThreadLoadPlan {
  const { anchor } = input;
  if (anchor && anchor !== input.ts && anchor !== input.anchorAttempted && !input.anchorCovered)
    return { anchor, kind: "anchored" };
  return input.hasPaging || input.hasError ? { kind: "none" } : { kind: "initial" };
}
