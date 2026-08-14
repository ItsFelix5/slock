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

  setActiveViewImplRef.current = (view: View) => {
    batch(() => {
      closeThread();
      viewState.setSelected(view);
      viewState.setNav("home");
      unread.clearChannelUnread(view.id);
      if (view.kind === "dm" && dms.closedDmIds[view.id]) dms.setClosedDmIds(view.id, false);
      panes.navigateFocusedPane(view);
    });
  };

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
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";
    viewState.setSelected({ id: channelId, kind });

    if (!options?.keepNav) viewState.setNav("home");
    unread.clearChannelUnread(channelId);
    openThread(channelId, ts, highlightTs);
  }

  function openChannelMessage(channelId: string, ts: string, options?: { keepNav?: boolean }) {
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";

    batch(() => {
      const unpinnedThread = panes
        .panes()
        .find((p) => p.content?.kind === "thread" && !p.content.pinned);
      if (
        unpinnedThread?.content?.kind === "thread" &&
        unpinnedThread.content.channelId !== channelId
      ) {
        closeThread();
      }
      viewState.setSelected({ id: channelId, kind });
      if (!options?.keepNav) viewState.setNav("home");
      unread.clearChannelUnread(channelId);
      if (kind === "dm" && dms.closedDmIds[channelId]) dms.setClosedDmIds(channelId, false);
      const target: ChannelMessageTarget = { channelId, ts };
      panes.navigateFocusedPane({ id: channelId, kind }, target);
    });
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
