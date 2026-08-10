import { batch } from "solid-js";
import { isDmId } from "./dmId";
import { buildSearchQuery, EMPTY_FILTERS, type SearchFilters } from "./searchQuery";
import type { Nav, View } from "./store/slices/types";
import type { createStoreSlices } from "./store/storeSlices";

type AppActionsDeps = Pick<
  ReturnType<typeof createStoreSlices>,
  | "activity"
  | "dms"
  | "later"
  | "realtime"
  | "setActiveView"
  | "setActiveViewImplRef"
  | "unread"
  | "viewState"
>;

/** Cross-domain actions for navigation and message focus. */
export function createAppActions(deps: AppActionsDeps) {
  const { dms, realtime, setActiveView, setActiveViewImplRef, unread, viewState } = deps;

  setActiveViewImplRef.current = (view: View) => {
    batch(() => {
      viewState.setActiveThread(null);
      viewState.setChannelMessageTarget(null);
      viewState.setSelected(view);
      viewState.setNav("home");
      unread.clearChannelUnread(view.id);
      if (view.kind === "dm" && dms.closedDmIds[view.id]) dms.setClosedDmIds(view.id, false);
    });
  };

  function setNavView(next: Nav) {
    viewState.setNav(next);
    if (next === "later") void deps.later.ensureLaterLoaded();
    if (next === "activity") void deps.activity.ensureActivityLoaded();
  }

  function openThread(channelId: string, ts: string, highlightTs?: string) {
    viewState.setActiveThread({ channelId, highlightTs, ts });
  }

  function closeThread() {
    const thread = viewState.activeThread();
    if (thread) realtime.send({ ts: thread.ts, type: "unwatch_thread" });
    viewState.setActiveThread(null);
  }

  function openChannelPeek(
    channelId: string,
    ts: string,
    highlightTs?: string,
    options?: { keepNav?: boolean },
  ) {
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";
    viewState.setSelected({ id: channelId, kind });
    // Desktop notifications jump out of whatever feed was showing — without
    // this the sidebar stays stuck on that feed while the channel/thread
    // opens behind it. Later and Activity opt out (keepNav) so browsing the
    // feed and opening items doesn't keep bouncing you back to the channel
    // list.
    if (!options?.keepNav) viewState.setNav("home");
    unread.clearChannelUnread(channelId);
    openThread(channelId, ts, highlightTs);
  }

  function openChannelMessage(channelId: string, ts: string, options?: { keepNav?: boolean }) {
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";
    // "View in channel" jumps the main list to the message without closing the
    // thread panel, so this can't go through setActiveView (it always clears
    // activeThread). That's only correct when the message is in the same
    // channel as the open thread — otherwise the thread panel is left showing
    // a channel the sidebar no longer agrees with, so close it here instead.
    // Batched so effects reacting to channelMessageTarget never observe the
    // in-between state where the view has switched but the real target hasn't
    // landed yet — that gap was enough to make MessageList's positioning
    // effect think it already handled this view, breaking the jump to a
    // message that isn't loaded yet.
    batch(() => {
      const thread = viewState.activeThread();
      if (thread && thread.channelId !== channelId) closeThread();
      viewState.setSelected({ id: channelId, kind });
      if (!options?.keepNav) viewState.setNav("home");
      unread.clearChannelUnread(channelId);
      if (kind === "dm" && dms.closedDmIds[channelId]) dms.setClosedDmIds(channelId, false);
      viewState.setChannelMessageTarget({ channelId, ts });
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
