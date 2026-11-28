import type { RichTextMessageMentionElement } from "@slock/types";

export function messageMentionUrl(
  el: RichTextMessageMentionElement,
  domain: string | null,
): string {
  if (el.url) return el.url;
  const base = `https://${domain ?? ""}/archives/${el.channel_id}/p${el.message_ts.replace(".", "")}`;
  return el.thread_ts && el.thread_ts !== el.message_ts
    ? `${base}?thread_ts=${el.thread_ts}`
    : base;
}
