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
    viewState.setActiveThread(null);
    viewState.setSelected(view);
    viewState.setNav("home");
    unread.clearChannelUnread(view.id);
    if (view.kind === "dm" && dms.closedDmIds[view.id]) dms.setClosedDmIds(view.id, false);
  };

  function setNavView(next: Nav) {
    viewState.setNav(next);
    if (next === "later") void deps.later.ensureLaterLoaded();
    if (next === "activity") void deps.activity.ensureActivityLoaded();
  }

  function openThread(channelId: string, ts: string) {
    viewState.setActiveThread({ channelId, ts });
  }

  function closeThread() {
    const thread = viewState.activeThread();
    if (thread) realtime.send({ ts: thread.ts, type: "unwatch_thread" });
    viewState.setActiveThread(null);
  }

  function openChannelPeek(channelId: string, ts: string) {
    // DM conversation ids are Slack "D..." ims (see viewState's parseNavPath) —
    // checking the id shape instead of the locally-loaded dms list means this
    // still routes correctly for a DM whose metadata hasn't synced yet (e.g.
    // jumping in from an Activity item for a conversation not opened before).
    const kind = channelId.startsWith("D") ? "dm" : "channel";
    viewState.setSelected({ id: channelId, kind });
    unread.clearChannelUnread(channelId);
    openThread(channelId, ts);
  }

  function openMessageSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    viewState.setSearchScreenQuery(query);
    viewState.setSearchScreenFilters(filters);
    setNavView("search");
  }

  return { closeThread, openChannelPeek, openMessageSearch, openThread, setActiveView, setNavView };
}
