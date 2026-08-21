import type { Message } from "./api";

export function isUnreadDividerBoundary(
  ts: string,
  prevTs: string | undefined,
  anchor: number,
): boolean {
  return (
    parseFloat(ts) * 1000 > anchor && (prevTs === undefined || parseFloat(prevTs) * 1000 <= anchor)
  );
}

export function findUnreadDividerIndex(messages: Message[], anchor: number | undefined): number {
  if (anchor == null || !Number.isFinite(anchor)) return -1;
  return messages.findIndex((msg, index) =>
    isUnreadDividerBoundary(msg.ts, messages[index - 1]?.ts, anchor),
  );
}
