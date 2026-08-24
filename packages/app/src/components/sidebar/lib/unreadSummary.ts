import { formatLastSeen } from "@slock/blockkit";
import type { Message } from "../../../lib/api";

export function unreadSummary(opts: {
  mentions?: number;
  lastRead?: number;
  currentUserId?: string;
  loadedMessages?: Message[];
  now?: number;
}): string {
  const now = opts.now ?? Date.now();
  const parts: string[] = [];
  if (opts.mentions) parts.push(`${opts.mentions} mention${opts.mentions === 1 ? "" : "s"}`);
  const { lastRead } = opts;
  if (opts.loadedMessages && lastRead != null) {
    const count = opts.loadedMessages.filter(
      (m) => parseFloat(m.ts) * 1000 > lastRead && m.userId !== opts.currentUserId,
    ).length;
    if (count) parts.push(`${count} unread message${count === 1 ? "" : "s"}`);
  }
  if (!parts.length) parts.push("Unread");
  if (opts.lastRead) parts.push(`since ${formatLastSeen(opts.lastRead, now)}`);
  return parts.join(" · ");
}
