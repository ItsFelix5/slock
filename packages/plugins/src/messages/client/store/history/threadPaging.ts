import type { Message, Ts } from "@slock/types";

export type ThreadPaging = {
  after?: string;
  before?: string;
  earlierError: boolean;
  earlierLoading: boolean;
  error: boolean;
  hasEarlier: boolean;
  hasMore: boolean;
  loading: boolean;
  span?: number;
};

export const idle = { earlierError: false, earlierLoading: false, error: false, loading: false };

export function forwardPatch(
  current: string | undefined,
  page: { edge?: string; hasMore: boolean },
): Partial<ThreadPaging> {
  if (page.edge !== undefined && current !== undefined && Number(page.edge) < Number(current))
    return {};
  return {
    after: page.edge ?? current,
    hasMore: page.hasMore && page.edge !== undefined && page.edge !== current,
  };
}

export function missingReplyCount(
  entry: Message[] | undefined,
  ts: Ts,
  state: ThreadPaging | undefined,
): number {
  const root = entry?.find((m) => m.ts === ts);
  if (!(entry && root && state) || state.hasMore || state.hasEarlier) return 0;
  return Math.max(0, (root.replyCount ?? 0) - (entry.length - 1));
}

export function coversAnchor(state: ThreadPaging | undefined, ts: Ts, anchor: Ts): boolean {
  if (!state) return false;
  const lower = state.hasEarlier ? Number(state.before) : Number(ts);
  const upper = state.hasMore ? Number(state.after) : Number.POSITIVE_INFINITY;
  return Number(anchor) >= lower && Number(anchor) <= upper;
}
