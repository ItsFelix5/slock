const SLACK_HOST_RE = /(^|\.)slack\.com$/i;
const ARCHIVE_PATH_RE = /^\/archives\/([A-Z0-9]+)\/p(\d+)\/?$/i;
const SLACK_TS_RE = /^\d+\.\d+$/;

export interface SlackPermalinkTarget {
  channelId: string;
  // The specific message the permalink points at — differs from threadTs
  // when the link is to a reply (permalink carries `?thread_ts=<root>`).
  messageTs: string;
  threadTs: string;
}

/** Return the in-app destination represented by a Slack message permalink. */
export function parseSlackPermalink(href: string): SlackPermalinkTarget | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !SLACK_HOST_RE.test(url.hostname)) return null;

  const match = ARCHIVE_PATH_RE.exec(url.pathname);
  if (!match) return null;

  const [, channelId, permalinkDigits] = match;
  if (permalinkDigits.length <= 6) return null;

  const messageTs = `${permalinkDigits.slice(0, -6)}.${permalinkDigits.slice(-6)}`;
  const requestedThreadTs = url.searchParams.get("thread_ts");
  const threadTs =
    requestedThreadTs && SLACK_TS_RE.test(requestedThreadTs) ? requestedThreadTs : messageTs;

  return { channelId, messageTs, threadTs };
}
