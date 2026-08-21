import { batch } from "solid-js";
import { isDmId } from "./dmId";
import { buildSearchQuery, EMPTY_FILTERS, type SearchFilters } from "./searchQuery";
import type { ChannelMessageTarget, Nav, View } from "./store/slices/types";
import type { createStoreSlices } from "./store/storeSlices";

type AppActionsDeps = Pick<
  ReturnType<typeof createStoreSlices>,
  | "activity"
  | "dms"
  | "later"
  | "panes"
  | "realtime"
  | "setActiveView"
  | "setActiveViewImplRef"
  | "unread"
  | "viewState"
>;

export function createAppActions(deps: AppActionsDeps) {
  const { dms, panes, realtime, setActiveView, setActiveViewImplRef, unread, viewState } = deps;

  function closeThread() {
    const thread = panes.panes().find((p) => p.content?.kind === "thread" && !p.content.pinned);
    if (thread?.content?.kind === "thread") {
      realtime.send({ ts: thread.content.ts, type: "unwatch_thread" });
    }
    panes.closeUnpinnedThread();
  }

  function closeThreadIfDifferentChannel(channelId: string) {
    const thread = panes.panes().find((p) => p.content?.kind === "thread" && !p.content.pinned);
    if (thread?.content?.kind === "thread" && thread.content.channelId !== channelId) {
      closeThread();
    }
  }

  function switchToConversation(
    channelId: string,
    options?: { keepNav?: boolean; target?: ChannelMessageTarget },
  ) {
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";
    batch(() => {
      closeThreadIfDifferentChannel(channelId);
      viewState.setSelected({ id: channelId, kind });
      if (!options?.keepNav) viewState.setNav("home");
      unread.clearChannelUnread(channelId);
      if (kind === "dm" && dms.closedDmIds[channelId]) dms.setClosedDmIds(channelId, false);
      panes.navigateFocusedPane({ id: channelId, kind }, options?.target);
    });
  }

  setActiveViewImplRef.current = (view: View) => switchToConversation(view.id);

  function setNavView(next: Nav) {
    viewState.setNav(next);
    if (next === "later") void deps.later.ensureLaterLoaded();
    if (next === "activity") void deps.activity.ensureActivityLoaded();
  }

  function openThread(
    channelId: string,
    ts: string,
    highlightTs?: string,
    opts?: { pinned?: boolean },
  ) {
    panes.openInNewPane({ channelId, highlightTs, kind: "thread", pinned: opts?.pinned, ts });
  }

  function openChannelPeek(
    channelId: string,
    ts: string,
    highlightTs?: string,
    options?: { keepNav?: boolean },
  ) {
    batch(() => {
      switchToConversation(channelId, options);
      openThread(channelId, ts, highlightTs);
    });
  }

  function openChannelMessage(channelId: string, ts: string, options?: { keepNav?: boolean }) {
    switchToConversation(channelId, { ...options, target: { channelId, ts } });
  }

  function openMessageSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    viewState.setSearchScreenQuery(buildSearchQuery(query, filters));
    viewState.setSearchScreenFilters(EMPTY_FILTERS);
    setNavView("search");
  }

  return {
    closeThread,
    openChannelMessage,
    openChannelPeek,
    openMessageSearch,
    openThread,
    setActiveView,
    setNavView,
  };
}
