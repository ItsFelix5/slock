// Discord-style "reply" references are encoded as a real Slack permalink
// prepended to the message text as an explicit `<url|label>` mrkdwn link —
// written out ourselves rather than left as a bare URL for Slack to
// autolink, with a leading marker (so we can tell our own reply links apart
// from a plain pasted link) and the label itself both set to a zero-width
// space. `​` isn't stripped by `.trim()` (it's Unicode category Cf, not
// whitespace), so both survive Composer's and store.sendMessage's trimming
// untouched.
//
// Writing the `<url|label>` syntax ourselves (instead of a bare URL) matters
// for two reasons: it round-trips through Slack unchanged instead of being
// reformatted by Slack's own autolink detector (which — since the marker
// isn't real whitespace either — used to swallow it into the link token and
// break re-parsing after the echo replaced the optimistic message), and it
// means the worst-case fallback (this failing to parse, or showing up in a
// real Slack client) renders an invisible label instead of the raw
// permalink text.
const REPLY_LINK_RE = /^<?(https?:\/\/[^\s|>]+)(?:\|[^>]*)?>??/;
const PERMALINK_RE = /\/archives\/([A-Z0-9]+)\/p(\d+)/;

export function encodeReplyLink(permalink: string): string {
  return `<${permalink}|​>`;
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
