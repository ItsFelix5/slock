// Discord-style "reply" references are encoded as a real Slack permalink
// prepended to the message text, wrapped in zero-width spaces so we can tell
// our own reply links apart from a plain pasted link. Being a real permalink
// means it degrades gracefully (auto-unfurls) in the real Slack client, and
// `​` isn't stripped by `.trim()` (it's Unicode category Cf, not
// whitespace), so the marker survives both Composer's and store.sendMessage's
// trimming untouched.
//
// Once the message round-trips through Slack, the plain URL we sent comes
// back auto-linkified into Slack's own `<url>` mrkdwn token (same syntax
// Mrkdwn already renders as a link elsewhere) — so the leading URL has to be
// matched with or without that wrapping, or the optimistic (pre-echo) render
// would parse fine and then "revert" to a plain link once the real message
// lands.
const MARK = "​";
const REPLY_LINK_RE = /^​<?(https?:\/\/[^\s|>]+)(?:\|[^>]*)?>?​\n/;
const PERMALINK_RE = /\/archives\/([A-Z0-9]+)\/p(\d+)/;

export function encodeReplyLink(permalink: string): string {
  return `${MARK}${permalink}${MARK}\n`;
}

export function parseReplyLink(
  text: string,
): { ts: string; channelId: string; rest: string; prefix: string } | null {
  const m = REPLY_LINK_RE.exec(text);
  if (!m) return null;
  const urlMatch = PERMALINK_RE.exec(m[1]);
  if (!urlMatch) return null;
  const [, channelId, digits] = urlMatch;
  const ts = `${digits.slice(0, -6)}.${digits.slice(-6)}`;
  return { channelId, ts, rest: text.slice(m[0].length), prefix: m[0] };
}
