import type { ChannelId, Message, Ts } from "@slock/types";

export type LatestMessage = { pending: boolean; ts: Ts };

export type DividerView = {
  hasNewer: boolean;
  id: ChannelId;
  lastRead: number;
  latest: LatestMessage | undefined;
};

export type DividerTracker = {
  anchored: ReadonlySet<ChannelId>;
  visible: ReadonlySet<ChannelId>;
};

export type DividerStep = {
  anchors: [ChannelId, number][];
  dropped: ChannelId[];
  tracker: DividerTracker;
};

export type ChannelSnapshot = {
  hasDivider: boolean;
  hasList: boolean;
  hasNewer: boolean;
  id: ChannelId;
  lastRead: number | undefined;
  latest: LatestMessage | undefined;
  unread: boolean;
  viewed: boolean;
};

export type ThreadSnapshot = {
  channelId: ChannelId;
  latest: LatestMessage | undefined;
  root: Message | undefined;
  ts: Ts;
  viewed: boolean;
};

export type ChannelReadPlan = { clear: boolean; mark?: { syncMs?: number; ts: Ts } };
export type ThreadReadPlan = { markTs: Ts; root: Message };

const toMs = (ts: Ts) => parseFloat(ts) * 1000;

export function dividerStep(
  prev: DividerTracker | undefined,
  visible: ReadonlySet<ChannelId>,
  candidates: DividerView[],
): DividerStep {
  const dropped = [...(prev?.visible ?? [])].filter((id) => !visible.has(id));
  const anchored = new Set(prev?.anchored);
  for (const id of dropped) anchored.delete(id);
  const anchors: [ChannelId, number][] = [];
  for (const { hasNewer, id, lastRead, latest } of candidates) {
    if (anchored.has(id) || hasNewer || !latest) continue;
    anchored.add(id);
    const hasUnreadGap = lastRead > 0 && toMs(latest.ts) > lastRead;
    anchors.push([id, hasUnreadGap ? lastRead : Infinity]);
  }
  return { anchors, dropped, tracker: { anchored, visible } };
}

export function channelReadPlan(
  { hasDivider, hasNewer, lastRead, latest, unread, viewed }: ChannelSnapshot,
  markedTs: Ts | undefined,
): ChannelReadPlan | undefined {
  if (!(hasDivider && viewed) || hasNewer) return;
  if (!latest || latest.pending) return;
  if (markedTs && (lastRead ?? 0) < toMs(markedTs)) return;
  if (markedTs === latest.ts) return { clear: unread };
  const latestMs = toMs(latest.ts);
  return {
    clear: true,
    mark: { syncMs: latestMs > (lastRead ?? 0) ? latestMs : undefined, ts: latest.ts },
  };
}

export function threadReadPlan(
  { latest, root, ts, viewed }: ThreadSnapshot,
  markedTs: Ts | undefined,
): ThreadReadPlan | undefined {
  if (!(viewed && root?.isSubscribed)) return;
  if (!latest || latest.ts === ts || latest.pending) return;
  if (markedTs === latest.ts) return;
  return { markTs: latest.ts, root };
}
