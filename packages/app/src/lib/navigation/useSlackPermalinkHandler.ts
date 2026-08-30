import { onCleanup, onMount } from "solid-js";
import { fetchPermalinkMessage } from "../api";
import { actionFeedback } from "../feedback";
import { consumeSharedProtocolLink } from "../incomingLinks";
import { handleMessageCopy } from "../messageCopy";
import { store } from "../store";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
} from "./slackPermalink";

export function useSlackPermalinkHandler(): void {
  const permalinkOpener = createSlackPermalinkOpener({
    navigate: (target, options) => navigateToSlackPermalink(target, store.viewState, options),
    onError: (error) => {
      console.error("Failed to open Slack permalink", error);
      actionFeedback.flash("navigation", "Couldn't open that message. Try again.", "error");
    },
    onUnavailable: () =>
      actionFeedback.flash("navigation", "That message is unavailable.", "error"),
    probe: async (target) =>
      !!(await fetchPermalinkMessage(target.channelId, target.messageTs, target.threadTs)),
  });

  const openSlackPermalink = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    permalinkOpener.invalidate();

    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const target = parseSlackPermalink(anchor.href);
    if (!target) return;

    event.preventDefault();
    actionFeedback.clear("navigation");

    const nav = store.viewState.nav();
    const keepNav = nav === "later" || nav === "activity";
    void permalinkOpener.open(target, { keepNav });
  };

  onMount(() => {
    document.addEventListener("click", openSlackPermalink);
    document.addEventListener("copy", handleMessageCopy);
    consumeSharedProtocolLink(permalinkOpener);
    onCleanup(() => {
      permalinkOpener.invalidate();
      document.removeEventListener("click", openSlackPermalink);
      document.removeEventListener("copy", handleMessageCopy);
    });
  });
}
