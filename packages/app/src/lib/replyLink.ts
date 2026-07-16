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
// Slack normalizes an empty/whitespace-only link label on its end, so the
// zero-width space we send doesn't always come back unchanged — it can
// round-trip as `.` or get dropped (bare `<url>`, or `<url|>`) depending on
// the path the message took (echo vs. history fetch vs. edit).
const BRACKETED_LINK_RE = /^<(https?:\/\/[^\s|>]+)(?:\|([^>]*))?>/;
// Real Slack clients represent a pasted message permalink as a `message_mention`
// rich_text element, and its `msg.text` fallback carries the bare permalink
// completely unwrapped — not `<...>`-delimited mrkdwn like every other link.
// Ordinary mrkdwn always brackets links, so an un-delimited permalink at the
// very start of the text can only be this fallback, never a typed message —
// treat it the same as an unlabeled reply link.
const BARE_PERMALINK_RE = /^(https?:\/\/[^\s<>]+)/;
const PERMALINK_RE = /\/archives\/([A-Z0-9]+)\/p(\d+)/;

function isBareLabel(label: string | undefined): boolean {
  return label === undefined || label === "" || label === "." || label === "​";
}

export function encodeReplyLink(permalink: string): string {
  return `<${permalink}|​>`;
}

// `isInThread` lets a caller with thread context (e.g. MessageRow rendering
// inside ThreadPanel) opt a *real*-labeled permalink into being treated as a
// reply reference too — someone quoting a message from the thread with their
// own words, not one of our own bare-labeled reply links. In that case the
// label is real message content, so it's kept in `rest` (as plain text,
// no longer wrapped in the link markup) instead of being discarded.
export function parseReplyLink(
  text: string,
  isInThread?: (channelId: string, ts: string) => boolean,
): { ts: string; channelId: string; rest: string; prefix: string } | null {
  const bracketed = BRACKETED_LINK_RE.exec(text);
  if (bracketed) {
    const urlMatch = PERMALINK_RE.exec(bracketed[1]);
    if (!urlMatch) return null;
    const [, channelId, digits] = urlMatch;
    const ts = `${digits.slice(0, -6)}.${digits.slice(-6)}`;
    const label = bracketed[2];
    const bare = isBareLabel(label);
    if (!(bare || isInThread?.(channelId, ts))) return null;
    const remainder = text.slice(bracketed[0].length);
    return {
      channelId,
      prefix: bracketed[0],
      rest: bare ? remainder : `${label}${remainder}`,
      ts,
    };
  }

  const bareLink = BARE_PERMALINK_RE.exec(text);
  if (!bareLink) return null;
  const urlMatch = PERMALINK_RE.exec(bareLink[1]);
  if (!urlMatch) return null;
  const [, channelId, digits] = urlMatch;
  const ts = `${digits.slice(0, -6)}.${digits.slice(-6)}`;
  return { channelId, prefix: bareLink[0], rest: text.slice(bareLink[0].length), ts };
}
