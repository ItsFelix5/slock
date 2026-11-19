import type { Message, Ts } from "@slock/types";
import { tsToMs } from "./tsTime";

export function isUnreadDividerBoundary(ts: Ts, prevTs: Ts | undefined, anchor: number): boolean {
  return tsToMs(ts) > anchor && (prevTs === undefined || tsToMs(prevTs) <= anchor);
}

export function findUnreadDividerIndex(messages: Message[], anchor: number | undefined): number {
  if (anchor == null || !Number.isFinite(anchor)) return -1;
  return messages.findIndex((msg, index) =>
    isUnreadDividerBoundary(msg.ts, messages[index - 1]?.ts, anchor),
  );
}
