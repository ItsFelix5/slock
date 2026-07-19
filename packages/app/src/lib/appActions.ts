import { batch } from "solid-js";
import { isDmId } from "./dmId";
import { EMPTY_FILTERS, type SearchFilters } from "./searchQuery";
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

  function openChannelPeek(channelId: string, ts: string, highlightTs?: string) {
    const kind = isDmId(channelId, (id) => !!dms.dmById(id)) ? "dm" : "channel";
    viewState.setSelected({ id: channelId, kind });
    unread.clearChannelUnread(channelId);
    openThread(channelId, ts, highlightTs);
  }

  function openChannelMessage(channelId: string, ts: string) {
    const kind = dms.dmById(channelId) ? "dm" : "channel";
    // "View in channel" — jumps the main list to the message without closing
    // the thread panel, so this can't go through setActiveView (it clears
    // activeThread as part of a normal channel switch). Batched so effects
    // reacting to channelMessageTarget never observe the in-between state
    // where the view has switched but the real target hasn't landed yet —
    // that gap was enough to make MessageList's positioning effect think it
    // already handled this view, breaking the jump to a message that isn't
    // loaded yet.
    batch(() => {
      viewState.setSelected({ id: channelId, kind });
      unread.clearChannelUnread(channelId);
      if (kind === "dm" && dms.closedDmIds[channelId]) dms.setClosedDmIds(channelId, false);
      viewState.setChannelMessageTarget({ channelId, ts });
    });
  }

  function openMessageSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    viewState.setSearchScreenQuery(query);
    viewState.setSearchScreenFilters(filters);
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
