import type { ActivityItem, DesktopNotificationEvent } from "@slock/types";

const NOTIFICATION_KINDS = [
  "mention",
  "dm",
  "thread_reply",
  "channel_mention",
  "channel_all",
  "keyword",
] as const satisfies ActivityItem["kind"][];

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const KIND_SET = new Set<string>(NOTIFICATION_KINDS);

export function isNotificationKind(kind: string): kind is NotificationKind {
  return KIND_SET.has(kind);
}

const BROADCAST_MENTION = /@(channel|here|everyone)\b/;

type Context = {
  channelId: string;
  isNotifyAll: boolean;
  matchesPingword: boolean;
};

export function classifyNotification(
  payload: DesktopNotificationEvent,
  launchParams: URLSearchParams,
  { channelId, isNotifyAll, matchesPingword }: Context,
): NotificationKind {
  const text = payload.msg ?? payload.content ?? "";
  if (channelId.startsWith("D")) return "dm";
  if (launchParams.has("thread_ts")) return "thread_reply";
  if (BROADCAST_MENTION.test(text)) return "channel_mention";
  if (matchesPingword) return "keyword";
  if (isNotifyAll) return "channel_all";
  return "mention";
}
