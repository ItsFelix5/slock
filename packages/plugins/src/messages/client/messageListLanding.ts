import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { createEffect, onCleanup, untrack } from "solid-js";
import type { ChannelMessageTarget, View } from "../../conversations/client/api/types";
import type { FeedScroll } from "./api/pane/scroll/feedScroll";
import { getRememberedScrollAnchor } from "./api/pane/scroll/rememberedAnchors";
import { findUnreadDividerIndex } from "./lib/unreadDivider";

const unreadStore = service("unread");
const messagesStore = service("messages");

const DIVIDER_WAIT_MS = 3000;

export function createMessageListLanding(deps: {
  clearMessageTarget: () => void;
  feed: FeedScroll;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  onViewSwitch: () => void;
  paneView: () => View | null;
}) {
  const { feed } = deps;
  let lastViewId: string | undefined;
  let positionedViewId: string | undefined;
  let requestedMessageTarget: ChannelMessageTarget | null = null;
  let dividerWait: ReturnType<typeof setTimeout> | undefined;

  const landOnBottom = () => feed.land({ at: "bottom" });

  function landOnDivider(view: View, anchor: number, windowLoaded: boolean) {
    const msgs = deps.messages();
    const [first] = msgs;
    const anchorAboveWindow = first && parseFloat(first.ts) * 1000 > anchor;
    if (!windowLoaded && anchorAboveWindow && messagesStore.hasMoreHistory(view.id)) {
      void loadWindowAroundAnchor(view, anchor);
      return;
    }
    const dividerTs = msgs[findUnreadDividerIndex(msgs, anchor)]?.ts;
    if (dividerTs) feed.land({ at: "row", ts: dividerTs, align: "start" });
    else landOnBottom();
  }

  async function loadWindowAroundAnchor(view: View, anchor: number) {
    const ok = await messagesStore.jumpToTs(view.id, (anchor / 1000).toFixed(6));
    if (ok) await messagesStore.loadNewerMessages(view.id);
    if (deps.paneView()?.id !== view.id) return;
    if (ok) landOnDivider(view, anchor, true);
    else landOnBottom();
  }

  function landOnRememberedOrBottom(view: View) {
    const remembered = getRememberedScrollAnchor(view.id);
    if (remembered && deps.messages().some((m) => m.ts === remembered.ts))
      feed.land({ at: "offset", ...remembered });
    else landOnBottom();
  }

  function waitForDivider(view: View) {
    dividerWait ??= setTimeout(() => {
      dividerWait = undefined;
      if (positionedViewId === view.id || deps.paneView()?.id !== view.id) return;
      positionedViewId = view.id;
      landOnRememberedOrBottom(view);
    }, DIVIDER_WAIT_MS);
  }
  onCleanup(() => clearTimeout(dividerWait));

  function landOnFirstMessage(jump: (viewId: string) => Promise<boolean>) {
    const view = deps.paneView();
    if (!view) return;
    void jump(view.id).then((ok) => {
      const [first] = deps.messages();
      if (ok && first && deps.paneView()?.id === view.id)
        feed.land({ at: "row", ts: first.ts, align: "start" });
    });
  }

  function landOnTarget(view: View, target: ChannelMessageTarget, msgs: Message[]) {
    if (msgs.some((candidate) => candidate.ts === target.ts)) {
      const reloaded = requestedMessageTarget === target;
      requestedMessageTarget = target;
      positionedViewId = view.id;
      deps.clearMessageTarget();
      if (reloaded || !untrack(feed.ready))
        feed.land({ at: "row", ts: target.ts, align: "center", flash: true });
      else feed.glideTo(target.ts);
      return;
    }
    if (requestedMessageTarget === target) return;
    requestedMessageTarget = target;
    void messagesStore.ensureChannelMessage(target.channelId, target.ts).then((found) => {
      if (!found && deps.messageTarget() === target) deps.clearMessageTarget();
    });
  }

  function landInitially(view: View) {
    const anchor = unreadStore.unreadDividerTsForChannel(view.id);
    if (anchor === undefined && !messagesStore.hasNewerHistory(view.id)) {
      waitForDivider(view);
      return;
    }
    clearTimeout(dividerWait);
    dividerWait = undefined;
    positionedViewId = view.id;
    if (anchor !== undefined && Number.isFinite(anchor)) landOnDivider(view, anchor, false);
    else landOnRememberedOrBottom(view);
  }

  createEffect(() => {
    const view = deps.paneView();
    const msgs = deps.messages();
    if (view?.id !== lastViewId) {
      lastViewId = view?.id;
      positionedViewId = undefined;
      clearTimeout(dividerWait);
      dividerWait = undefined;
      deps.onViewSwitch();
    }
    if (!(view && feed.element())) return;

    const target = deps.messageTarget();
    if (target?.channelId === view.id) landOnTarget(view, target, msgs);
    else if (positionedViewId !== view.id && msgs.length > 0) landInitially(view);
  });

  return {
    jumpToBeginning: () => landOnFirstMessage(messagesStore.jumpToBeginning),
    jumpToDate: (dateMs: number) =>
      landOnFirstMessage((viewId) => messagesStore.jumpToDate(viewId, dateMs)),
    jumpToMessage: feed.glideTo,
  };
}
