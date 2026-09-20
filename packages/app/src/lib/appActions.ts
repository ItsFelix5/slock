import { focusPaneById } from "@slock/ui";
import { batch } from "solid-js";
import { suppressNextComposerAutofocus } from "./composerAutofocus";
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
  | "users"
  | "viewState"
>;

export function createAppActions(deps: AppActionsDeps) {
  const { dms, panes, realtime, setActiveView, setActiveViewImplRef, unread, users, viewState } =
    deps;

  function closeTile(paneId: string) {
    const pane = panes.panes().find((p) => p.id === paneId);
    if (pane?.content?.kind === "thread") {
      realtime.send({ ts: pane.content.ts, type: "unwatch_thread" });
    }
    panes.closePane(paneId);
  }

  function canCloseTile(): boolean {
    return panes.panes().length > 1;
  }

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
    options?: { autofocus?: boolean; keepNav?: boolean; target?: ChannelMessageTarget },
  ) {
    if (options?.autofocus === false) suppressNextComposerAutofocus();
    const kind = dms.conversationKind(channelId);
    batch(() => {
      closeThreadIfDifferentChannel(channelId);
      users.closeUserProfile();
      viewState.setSelected({ id: channelId, kind });
      if (!options?.keepNav) viewState.setNav("home");
      unread.clearChannelUnread(channelId);
      if (kind === "dm" && dms.closedDmIds[channelId]) dms.setClosedDmIds(channelId, false);
      panes.navigateFocusedPane({ id: channelId, kind }, options?.target);
    });
  }

  setActiveViewImplRef.current = (view: View, options?: { autofocus?: boolean }) =>
    switchToConversation(view.id, options);

  function setNavView(next: Nav) {
    viewState.setNav(next);
    if (next !== "search") queueMicrotask(() => focusPaneById("sidebar"));
  }

  function openThread(
    channelId: string,
    ts: string,
    highlightTs?: string,
    opts?: { autofocus?: boolean; pinned?: boolean },
  ) {
    if (opts?.autofocus === false) suppressNextComposerAutofocus();
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
    canCloseTile,
    closeThread,
    closeTile,
    openChannelMessage,
    openChannelPeek,
    openMessageSearch,
    openThread,
    setActiveView,
    setNavView,
    switchToConversation,
  };
}
