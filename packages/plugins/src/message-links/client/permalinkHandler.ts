import { getHost, service } from "@slock/core/solid";
import {
  openConversation,
  openConversationInSplit,
} from "@slock/plugins/conversations/client/api/nav";
import { fetchPermalinkMessage } from "@slock/plugins/slack/client/api";
import type { ChannelId, Ts } from "@slock/types";
import { onLinkClick } from "@slock/ui/linkClick";
import { onSettled } from "solid-js";
import { consumeSharedProtocolLink } from "./api/incomingLinks";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  openSlackPermalinkInSplit,
  parseSlackChannelLink,
  parseSlackPermalink,
} from "./api/slackPermalink";
import { handleMessageCopy } from "./messageCopy";

const feedback = service("feedback");

const messageLinks = service("message-links");

export function installPermalinkHandler(
  loaders: () => ((channelId: ChannelId, ts: Ts, threadTs: Ts) => Promise<boolean>)[],
): void {
  const permalinkOpener = createSlackPermalinkOpener({
    navigate: (target, options) => {
      if (options?.split) {
        openSlackPermalinkInSplit(target, messageLinks);
        return;
      }
      navigateToSlackPermalink(target, messageLinks);
    },
    onError: (error) => {
      console.error("Failed to open Slack permalink", error);
      feedback.flash("navigation", "Couldn't open that message. Try again.", "error");
    },
    onUnavailable: () => feedback.flash("navigation", "That message is unavailable.", "error"),
    probe: async (target) => {
      const { channelId, messageTs, threadTs } = target;
      const loads = await Promise.all(
        loaders().map((load) => load(channelId, messageTs, threadTs)),
      );
      if (loads.some(Boolean)) return true;
      const isReply = threadTs !== messageTs;
      return isReply && !!(await fetchPermalinkMessage(channelId, messageTs, threadTs));
    },
  });

  const openSlackLink = (anchor: HTMLAnchorElement, event: MouseEvent) => {
    permalinkOpener.invalidate();

    const channelId = parseSlackChannelLink(anchor.href);
    if (channelId) {
      feedback.clear("navigation");
      if (event.shiftKey) openConversationInSplit(channelId);
      else openConversation(channelId);
      return true;
    }

    const target = parseSlackPermalink(anchor.href);
    if (!target) return false;

    feedback.clear("navigation");
    void permalinkOpener.open(target, { split: event.shiftKey });
    return true;
  };

  onSettled(() => {
    const stopLinkClicks = onLinkClick(openSlackLink);
    document.addEventListener("copy", handleMessageCopy);
    void getHost()
      .idle()
      .then(() => consumeSharedProtocolLink(permalinkOpener));
    return () => {
      permalinkOpener.invalidate();
      stopLinkClicks();
      document.removeEventListener("copy", handleMessageCopy);
    };
  });
}
