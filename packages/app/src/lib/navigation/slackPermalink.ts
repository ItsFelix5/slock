const SLACK_HOST_RE: RegExp = /(^|\.)slack\.com$/i;
const ARCHIVE_PATH_RE = /^\/archives\/([A-Z0-9]+)\/p(\d+)\/?$/i;
const SLACK_TS_RE = /^\d+\.\d+$/;

export interface SlackPermalinkTarget {
  channelId: string;
  // The specific message the permalink points at — differs from threadTs
  // when the link is to a reply (permalink carries `?thread_ts=<root>`).
  messageTs: string;
  threadTs: string;
}

export interface SlackPermalinkNavigator {
  openChannelMessage: (channelId: string, ts: string, options?: { keepNav?: boolean }) => void;
  openChannelPeek: (
    channelId: string,
    threadTs: string,
    highlightTs?: string,
    options?: { keepNav?: boolean },
  ) => void;
}

export interface SlackPermalinkOpenerDeps {
  navigate: (target: SlackPermalinkTarget, options?: { keepNav?: boolean }) => void;
  onError: (error: unknown) => void;
  onUnavailable: () => void;
  probe: (target: SlackPermalinkTarget) => Promise<boolean>;
}

/**
 * Coordinates permalink probes so a slow response cannot override a newer
 * click. Calling invalidate also makes cleanup and unrelated primary clicks
 * explicitly cancel the pending navigation.
 */
export function createSlackPermalinkOpener(deps: SlackPermalinkOpenerDeps) {
  let requestId = 0;

  function invalidate() {
    requestId++;
  }

  async function open(target: SlackPermalinkTarget, options?: { keepNav?: boolean }) {
    const currentRequestId = ++requestId;
    try {
      const available = await deps.probe(target);
      if (currentRequestId !== requestId) return;
      if (!available) {
        deps.onUnavailable();
        return;
      }
      deps.navigate(target, options);
    } catch (error) {
      if (currentRequestId === requestId) deps.onError(error);
    }
  }

  return { invalidate, open };
}

export function navigateToSlackPermalink(
  target: SlackPermalinkTarget,
  navigator: SlackPermalinkNavigator,
  options?: { keepNav?: boolean },
) {
  if (target.threadTs !== target.messageTs) {
    navigator.openChannelPeek(target.channelId, target.threadTs, target.messageTs, options);
    return;
  }
  navigator.openChannelMessage(target.channelId, target.messageTs, options);
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
