import { getHost, service } from "@slock/core/solid";
import { onCleanup, onMount } from "solid-js";
import { openConversationInSplit } from "../../conversations/client/api/nav";
import { fetchPermalinkMessage } from "../../slack/client/api";
import { consumeSharedProtocolLink } from "./api/incomingLinks";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
} from "./api/slackPermalink";
import { handleMessageCopy } from "./messageCopy";

const feedback = service("feedback");

const messageLinks = service("message-links");

export function installPermalinkHandler(): void {
  const permalinkOpener = createSlackPermalinkOpener({
    navigate: (target, options) => {
      if (options?.split) {
        if (target.threadTs === target.messageTs)
          openConversationInSplit(target.channelId, target.messageTs);
        else
          messageLinks.openThread(target.channelId, target.threadTs, target.messageTs, {
            pinned: true,
          });
        return;
      }
      navigateToSlackPermalink(target, messageLinks);
    },
    onError: (error) => {
      console.error("Failed to open Slack permalink", error);
      feedback.flash("navigation", "Couldn't open that message. Try again.", "error");
    },
    onUnavailable: () => feedback.flash("navigation", "That message is unavailable.", "error"),
    probe: async (target) =>
      !!(await fetchPermalinkMessage(target.channelId, target.messageTs, target.threadTs)),
  });

  const openSlackPermalink = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;

    const split = event.shiftKey;

    permalinkOpener.invalidate();

    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest<HTMLAnchorElement>("a[href]") ?? null;
    if (!anchor) return;

    const target = parseSlackPermalink(anchor.href);
    if (!target) return;

    event.preventDefault();
    feedback.clear("navigation");

    void permalinkOpener.open(target, { split });
  };

  onMount(() => {
    document.addEventListener("click", openSlackPermalink);
    document.addEventListener("copy", handleMessageCopy);
    void getHost()
      .idle()
      .then(() => consumeSharedProtocolLink(permalinkOpener));
    onCleanup(() => {
      permalinkOpener.invalidate();
      document.removeEventListener("click", openSlackPermalink);
      document.removeEventListener("copy", handleMessageCopy);
    });
  });
}
