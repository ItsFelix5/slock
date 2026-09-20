import { createEffect, createSignal } from "solid-js";
import type { Message } from "../../lib/api";
import type { ChannelMessageTarget, View } from "../../lib/store";
import { store } from "../../lib/store";
import { findUnreadDividerIndex } from "./lib/unreadDivider";
import {
  flashMessageElement,
  getRememberedScrollAnchor,
  jumpToMessageInContainer,
  rememberScrollAnchor,
  restoreScrollAnchor,
  scrollToBottom,
  waitForMessageElement,
} from "./scrollAnchor";

const MAX_BACKFILL_LOADS = 5;

export function createMessageListLanding(deps: {
  clearMessageTarget: () => void;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  paneView: () => View | null;
  scrollRef: () => HTMLDivElement | undefined;
}) {
  let lastViewId: string | undefined;
  let positionedViewId: string | undefined;
  let landingRun = 0;
  let requestedMessageTarget: ReturnType<typeof deps.messageTarget> = null;
  let cancelPendingFlash: (() => void) | undefined;
  const backfillAttempts: Record<string, number> = {};

  const [readyViewId, setReadyViewId] = createSignal<string>();
  const [shouldFollowBottom, setShouldFollowBottom] = createSignal(true);

  function landOnBottom(viewId: string) {
    const run = ++landingRun;
    setShouldFollowBottom(true);
    queueMicrotask(() => {
      const el = deps.scrollRef();
      if (run !== landingRun || deps.paneView()?.id !== viewId || !el) return;
      scrollToBottom(el);
      setReadyViewId(viewId);
    });
  }

  function landOnMessage(viewId: string, ts: string, align: ScrollLogicalPosition, flash = false) {
    const el = deps.scrollRef();
    if (!el) return;
    const run = ++landingRun;
    setShouldFollowBottom(false);
    cancelPendingFlash?.();
    cancelPendingFlash = waitForMessageElement(el, ts, (row) => {
      if (run !== landingRun || deps.paneView()?.id !== viewId) return;
      row.scrollIntoView({ block: align });
      if (flash) cancelPendingFlash = flashMessageElement(row);
      setReadyViewId(viewId);
    });
  }

  function landOnDivider(viewId: string, dividerTs: string) {
    const el = deps.scrollRef();
    if (!el) return;
    const run = ++landingRun;
    setShouldFollowBottom(false);
    cancelPendingFlash?.();
    cancelPendingFlash = waitForMessageElement(el, dividerTs, (dividerRow) => {
      const current = deps.scrollRef();
      if (run !== landingRun || deps.paneView()?.id !== viewId || !current) return;
      const containerRect = current.getBoundingClientRect();
      const dividerRect = dividerRow.getBoundingClientRect();
      const unreadContentHeight =
        current.scrollHeight - (dividerRect.top - containerRect.top + current.scrollTop);
      if (unreadContentHeight <= current.clientHeight) {
        setShouldFollowBottom(true);
        scrollToBottom(current);
      } else {
        dividerRow.scrollIntoView({ block: "start" });
      }
      setReadyViewId(viewId);
    });
  }

  function landOnRememberedAnchor(viewId: string, anchor: { offset: number; ts: string }) {
    const el = deps.scrollRef();
    if (!el) return;
    const run = ++landingRun;
    setShouldFollowBottom(false);
    cancelPendingFlash?.();
    cancelPendingFlash = waitForMessageElement(el, anchor.ts, (row) => {
      const current = deps.scrollRef();
      if (run !== landingRun || deps.paneView()?.id !== viewId || !current) return;
      restoreScrollAnchor(current, { el: row, offset: anchor.offset });
      setReadyViewId(viewId);
    });
  }

  function cancelLanding() {
    landingRun += 1;
    const view = deps.paneView();
    if (view && readyViewId() !== view.id) setReadyViewId(view.id);
  }

  function landOnDividerOrBottom(view: View, msgs: Message[]) {
    const anchor = store.unread.unreadDividerTsForChannel(view.id);
    if (anchor === undefined) return;
    const readCursorNotYetLoaded = parseFloat(msgs[0].ts) * 1000 > anchor;

    const alreadyAttempted = (backfillAttempts[view.id] ?? 0) >= MAX_BACKFILL_LOADS;
    let gaveUpBackfill = false;
    if (readCursorNotYetLoaded && store.messages.hasMoreHistory(view.id)) {
      if (store.messages.hasOlderHistoryError(view.id)) return;
      if (store.messages.isLoadingHistory(view.id)) return;
      if (!alreadyAttempted) {
        backfillAttempts[view.id] = MAX_BACKFILL_LOADS;
        store.messages.loadOlderMessagesThrough(view.id, anchor, MAX_BACKFILL_LOADS);
        return;
      }
      gaveUpBackfill = true;
    }

    delete backfillAttempts[view.id];
    positionedViewId = view.id;

    const dividerIndex = gaveUpBackfill ? -1 : findUnreadDividerIndex(msgs, anchor);
    const dividerTs = dividerIndex >= 0 ? msgs[dividerIndex]?.ts : undefined;
    if (dividerTs) landOnDivider(view.id, dividerTs);
    else landOnBottom(view.id);
  }

  function jumpToMessage(ts: string) {
    const container = deps.scrollRef();
    if (!container) return;
    setShouldFollowBottom(false);
    cancelPendingFlash?.();
    cancelPendingFlash = jumpToMessageInContainer(container, ts);
  }

  function jumpToDate(dateMs: number) {
    const view = deps.paneView();
    if (!view) return;
    void store.messages.jumpToDate(view.id, dateMs).then((ok) => {
      if (!ok || deps.paneView()?.id !== view.id) return;
      queueMicrotask(() => {
        const [first] = deps.messages();
        if (first) landOnMessage(view.id, first.ts, "start");
      });
    });
  }

  function jumpToBeginning() {
    const view = deps.paneView();
    if (!view) return;
    void store.messages.jumpToBeginning(view.id).then((ok) => {
      if (!ok || deps.paneView()?.id !== view.id) return;
      queueMicrotask(() => {
        const [first] = deps.messages();
        if (first) landOnMessage(view.id, first.ts, "start");
      });
    });
  }

  createEffect(() => {
    const view = deps.paneView();
    const msgs = deps.messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    if (switchedView) {
      landingRun += 1;
      positionedViewId = undefined;
      setShouldFollowBottom(true);
      cancelPendingFlash?.();
      cancelPendingFlash = undefined;
    }
    const el = deps.scrollRef();
    if (!(el && view)) return;

    const target = deps.messageTarget();
    if (target?.channelId === view.id) {
      const index = msgs.findIndex((candidate) => candidate.ts === target.ts);
      if (index >= 0) {
        requestedMessageTarget = target;
        const coldOpen = readyViewId() !== view.id;
        deps.clearMessageTarget();
        positionedViewId = view.id;
        if (coldOpen) landOnMessage(view.id, target.ts, "center", true);
        else jumpToMessage(target.ts);
        return;
      }

      if (requestedMessageTarget !== target) {
        requestedMessageTarget = target;
        void store.messages.ensureChannelMessage(target.channelId, target.ts).then((found) => {
          if (!found && deps.messageTarget() === target) deps.clearMessageTarget();
        });
      }
      return;
    }

    if (positionedViewId !== view.id && msgs.length > 0) {
      const remembered = getRememberedScrollAnchor(view.id);
      if (remembered && msgs.some((m) => m.ts === remembered.ts)) {
        positionedViewId = view.id;
        landOnRememberedAnchor(view.id, remembered);
      } else {
        landOnDividerOrBottom(view, msgs);
      }
    }
  });

  function trackScrollAnchor(viewId: string, anchor: { offset: number; ts: string }) {
    if (readyViewId() === viewId) rememberScrollAnchor(viewId, anchor);
  }

  return {
    cancelLanding,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    readyViewId,
    setShouldFollowBottom,
    shouldFollowBottom,
    trackScrollAnchor,
  };
}
