import { defined } from "@slock/core";
import { isChannelId, isTs } from "@slock/slack";
import type { ChannelId, Ts } from "@slock/types";

const SLACK_HOST_RE: RegExp = /(^|\.)slack\.com$/i;
const ARCHIVE_PATH_RE = /^\/archives\/([A-Z0-9]+)\/p(\d+)\/?$/;
const CLIENT_CHANNEL_PATH_RE = /^\/client\/([A-Z0-9]+)\/([A-Z0-9]+)\/?$/;
const SLACK_TS_RE = /^\d+\.\d+$/;

export interface SlackPermalinkTarget {
  channelId: ChannelId;

  messageTs: Ts;
  threadTs: Ts;
}

interface SlackPermalinkNavigator {
  openChannelMessage: (channelId: ChannelId, ts: Ts) => void;
  openChannelPeek: (channelId: ChannelId, threadTs: Ts, highlightTs?: Ts) => void;
  openMessageInSplit: (channelId: ChannelId, ts: Ts, threadTs?: Ts) => void;
}

interface SlackPermalinkOpenerDeps {
  navigate: (target: SlackPermalinkTarget, options?: { split?: boolean }) => void;
  onError: (error: unknown) => void;
  onUnavailable: () => void;
  probe: (target: SlackPermalinkTarget) => Promise<boolean>;
}

export function createSlackPermalinkOpener(deps: SlackPermalinkOpenerDeps) {
  let requestId = 0;

  function invalidate() {
    requestId++;
  }

  async function open(target: SlackPermalinkTarget, options?: { split?: boolean }) {
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
  navigator: Omit<SlackPermalinkNavigator, "openMessageInSplit">,
) {
  if (target.threadTs !== target.messageTs) {
    navigator.openChannelPeek(target.channelId, target.threadTs, target.messageTs);
    return;
  }
  navigator.openChannelMessage(target.channelId, target.messageTs);
}

export function openSlackPermalinkInSplit(
  target: SlackPermalinkTarget,
  navigator: Pick<SlackPermalinkNavigator, "openMessageInSplit">,
) {
  const isReply = target.threadTs !== target.messageTs;
  navigator.openMessageInSplit(
    target.channelId,
    target.messageTs,
    isReply ? target.threadTs : undefined,
  );
}

function slackUrl(href: string): URL | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return url.protocol === "https:" && SLACK_HOST_RE.test(url.hostname) ? url : null;
}

export function parseSlackChannelLink(href: string): ChannelId | null {
  const url = slackUrl(href);
  const channelId = url && CLIENT_CHANNEL_PATH_RE.exec(url.pathname)?.[2];
  return channelId && isChannelId(channelId) ? channelId : null;
}

export function parseSlackPermalink(href: string): SlackPermalinkTarget | null {
  const url = slackUrl(href);
  if (!url) return null;

  const match = ARCHIVE_PATH_RE.exec(url.pathname);
  if (!match) return null;

  const [, channelId, permalinkDigits] = match;
  if (defined(permalinkDigits).length <= 6) return null;

  const messageTs = `${defined(permalinkDigits).slice(0, -6)}.${defined(permalinkDigits).slice(-6)}`;
  const requestedThreadTs = url.searchParams.get("thread_ts");
  const threadTs =
    requestedThreadTs && SLACK_TS_RE.test(requestedThreadTs) ? requestedThreadTs : messageTs;

  if (!(channelId && isChannelId(channelId) && isTs(messageTs) && isTs(threadTs))) return null;
  return { channelId, messageTs, threadTs };
}
