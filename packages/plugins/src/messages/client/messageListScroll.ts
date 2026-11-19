import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ChannelMessageTarget, View } from "../../conversations/client/api/types";
import { createFeedPagination } from "./api/pane/scroll/feedPagination";
import { createFeedScroll } from "./api/pane/scroll/feedScroll";
import { rememberScrollAnchor } from "./api/pane/scroll/rememberedAnchors";
import { createMessageListLanding } from "./messageListLanding";

const messagesStore = service("messages");
const unreadStore = service("unread");

export function createMessageListScroll(deps: {
  clearMessageTarget: () => void;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  paneView: () => View | null;
}) {
  const viewId = () => deps.paneView()?.id ?? "";
  const isLive = () => !messagesStore.hasNewerHistory(viewId());
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);

  async function loadNewerMessages(channelId: string) {
    setIsLoadingNewer(true);
    try {
      await messagesStore.loadNewerMessages(channelId);
    } finally {
      setIsLoadingNewer(false);
    }
  }

  const pagination = createFeedPagination({
    busy: () => messagesStore.isLoadingHistory(viewId()),
    canLoadNewer: () =>
      messagesStore.hasNewerHistory(viewId()) && !messagesStore.hasNewerHistoryError(viewId()),
    canLoadOlder: () =>
      messagesStore.hasMoreHistory(viewId()) && !messagesStore.hasOlderHistoryError(viewId()),
    loadNewer: () => void loadNewerMessages(viewId()),
    loadOlder: () => void messagesStore.loadOlderMessages(viewId()),
    ready: () => feed.ready(),
    scroller: () => feed.element(),
    size: () => deps.messages().length,
  });

  const feed = createFeedScroll({
    isLive,
    onMove: (direction) => {
      if (!feed.ready()) return;
      rememberScrollAnchor(viewId(), feed.atBottom() && isLive() ? undefined : feed.topAnchor());
      pagination.check(direction);
    },
  });

  const landing = createMessageListLanding({
    ...deps,
    feed,
    onViewSwitch: () => {
      feed.reset();
      pagination.reset();
    },
  });

  createEffect(() => {
    const id = deps.paneView()?.id;
    if (id) onCleanup(() => unreadStore.setBottomSeen(id, false));
  });
  createEffect(() => {
    const id = deps.paneView()?.id;
    if (id) unreadStore.setBottomSeen(id, feed.ready() && feed.atBottom() && isLive());
  });

  const visibleDay = () => {
    const ts = feed.topTs();
    return ts === undefined ? undefined : deps.messages().find((m) => m.ts === ts)?.day;
  };

  return { ...landing, feed, isLoadingNewer, loadNewerMessages, visibleDay };
}
