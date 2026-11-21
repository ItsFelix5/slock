import { service } from "@slock/core/solid";
import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import type { ChannelId, Message } from "@slock/types";
import { createSignal } from "solid-js";
import { createFeedPagination } from "./api/pane/scroll/feedPagination";
import { createFeedScroll } from "./api/pane/scroll/feedScroll";
import { createMessageListLanding } from "./messageListLanding";

const messagesStore = service("messages");
const unreadStore = service("unread");
const scrollAnchors = service("messages.anchors");

export function createMessageListScroll(deps: {
  clearMessageTarget: () => void;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  paneView: () => View | null;
}) {
  const viewId = () => deps.paneView()?.id;
  const whenView = <T>(read: (id: ChannelId) => T, fallback: T) => {
    const id = viewId();
    return id === undefined ? fallback : read(id);
  };
  const isLive = () => whenView((id) => !messagesStore.hasNewerHistory(id), true);
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);

  async function loadNewerMessages(channelId: ChannelId) {
    setIsLoadingNewer(true);
    try {
      await messagesStore.loadNewerMessages(channelId);
    } finally {
      setIsLoadingNewer(false);
    }
  }

  const feed = createFeedScroll({
    isLive,
    onMove: (direction) => {
      if (!feed.ready()) return;
      whenView(
        (id) =>
          scrollAnchors.remember(id, feed.atBottom() && isLive() ? undefined : feed.topAnchor()),
        undefined,
      );
      pagination.check(direction);
    },
  });

  const pagination = createFeedPagination({
    busy: () => whenView((id) => messagesStore.isLoadingHistory(id), false),
    canLoadNewer: () =>
      whenView(
        (id) => messagesStore.hasNewerHistory(id) && !messagesStore.hasNewerHistoryError(id),
        false,
      ),
    canLoadOlder: () =>
      whenView(
        (id) => messagesStore.hasMoreHistory(id) && !messagesStore.hasOlderHistoryError(id),
        false,
      ),
    loadNewer: () => whenView((id) => void loadNewerMessages(id), undefined),
    loadOlder: () => whenView((id) => void messagesStore.loadOlderMessages(id), undefined),
    ready: () => feed.ready(),
    scroller: () => feed.element(),
    size: () => deps.messages().length,
  });

  const landing = createMessageListLanding({
    ...deps,
    feed,
    onViewSwitch: () => {
      feed.reset();
      pagination.reset();
    },
  });

  unreadStore.trackBottomSeen(viewId, () => feed.ready() && feed.atBottom() && isLive());

  const visibleDay = () => {
    const ts = feed.topTs();
    return ts === undefined ? undefined : deps.messages().find((m) => m.ts === ts)?.day;
  };

  return { ...landing, feed, isLoadingNewer, loadNewerMessages, visibleDay };
}
