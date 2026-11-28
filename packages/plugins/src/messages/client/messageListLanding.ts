import type { TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import type { ChannelId, Message, Ts } from "@slock/types";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import type { FeedScroll } from "./api/pane/scroll/feedScroll";
import { initialLandingState, type LandingStep, planLanding } from "./lib/landingPlan";
import { tsFromMs, tsToMs } from "./lib/tsTime";
import { findUnreadDividerIndex } from "./lib/unreadDivider";

const unreadStore = service("unread");
const messagesStore = service("messages");
const scrollAnchors = service("messages.anchors");
const env = service("env");

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
  let state = initialLandingState;
  let dividerWait: TimerHandle | undefined;

  const [landedTs, setLandedTs] = createSignal<Ts>();

  const landOnBottom = () => {
    feed.land({ at: "bottom" });
    setLandedTs(deps.messages().at(-1)?.ts);
  };

  const landOnRow = (ts: Ts) => {
    feed.land({ at: "row", ts, align: "start" });
    setLandedTs(ts);
  };

  function landOnDivider(view: View, anchor: number, windowLoaded: boolean) {
    const msgs = deps.messages();
    const [first] = msgs;
    const anchorAboveWindow = first && tsToMs(first.ts) > anchor;
    if (!windowLoaded && anchorAboveWindow && messagesStore.hasMoreHistory(view.id)) {
      void loadWindowAroundAnchor(view, anchor);
      return;
    }
    const dividerTs = msgs[findUnreadDividerIndex(msgs, anchor)]?.ts;
    if (dividerTs) landOnRow(dividerTs);
    else landOnBottom();
  }

  async function loadWindowAroundAnchor(view: View, anchor: number) {
    const ok = await messagesStore.jumpToTs(view.id, tsFromMs(anchor));
    if (ok) await messagesStore.loadNewerMessages(view.id);
    if (deps.paneView()?.id !== view.id) return;
    if (ok) landOnDivider(view, anchor, true);
    else landOnBottom();
  }

  function landOnRememberedOrBottom(view: View) {
    const remembered = scrollAnchors.get(view.id);
    if (remembered && deps.messages().some((m) => m.ts === remembered.ts))
      feed.land({ at: "offset", ...remembered });
    else landOnBottom();
  }

  function waitForDivider(view: View) {
    dividerWait ??= env.setTimeout(() => {
      dividerWait = undefined;
      if (state.positionedViewId === view.id || deps.paneView()?.id !== view.id) return;
      state = { ...state, positionedViewId: view.id };
      landOnRememberedOrBottom(view);
    }, DIVIDER_WAIT_MS);
  }
  onCleanup(() => env.clearTimeout(dividerWait));

  function landOnFirstMessage(jump: (viewId: ChannelId) => Promise<boolean>) {
    const view = deps.paneView();
    if (!view) return;
    void jump(view.id).then((ok) => {
      const [first] = deps.messages();
      if (ok && first && deps.paneView()?.id === view.id)
        feed.land({ at: "row", ts: first.ts, align: "start" });
    });
  }

  function run(view: View, step: LandingStep) {
    if (step.kind === "land-target") {
      deps.clearMessageTarget();
      if (step.reloaded || !untrack(feed.ready))
        feed.land({ at: "row", ts: step.target.ts, align: "center", flash: true });
      else feed.jumpTo(step.target.ts);
    } else if (step.kind === "request-target") {
      void messagesStore
        .ensureChannelMessage(step.target.channelId, step.target.ts)
        .then((found) => {
          if (!found && deps.messageTarget() === step.target) deps.clearMessageTarget();
        });
    } else if (step.kind === "wait-divider") {
      waitForDivider(view);
    } else if (step.kind === "land-initial") {
      env.clearTimeout(dividerWait);
      dividerWait = undefined;
      if (step.anchor === undefined) landOnRememberedOrBottom(view);
      else landOnDivider(view, step.anchor, false);
    }
  }

  createEffect(
    () => {
      const view = deps.paneView();
      const msgs = deps.messages();
      const target = deps.messageTarget();
      return {
        anchor: view ? unreadStore.unreadDividerTsForChannel(view.id) : undefined,
        hasElement: !!feed.element(),
        hasMessages: msgs.length > 0,
        hasNewer: !!view && messagesStore.hasNewerHistory(view.id),
        target,
        targetLoaded: !!target && msgs.some((m) => m.ts === target.ts),
        view,
        viewId: view?.id,
      };
    },
    ({ anchor, hasElement, hasMessages, hasNewer, target, targetLoaded, view, viewId }) => {
      untrack(() => {
        const {
          state: next,
          step,
          viewSwitched,
        } = planLanding(state, {
          anchor,
          hasElement,
          hasMessages,
          hasNewer,
          target,
          targetLoaded,
          viewId,
        });
        state = next;
        if (viewSwitched) {
          env.clearTimeout(dividerWait);
          dividerWait = undefined;
          deps.onViewSwitch();
        }
        if (view) run(view, step);
      });
    },
  );

  const unreadAnchor = () => {
    const view = deps.paneView();
    return view ? unreadStore.unreadDividerTsForChannel(view.id) : undefined;
  };

  async function jumpToLatest() {
    const view = deps.paneView();
    if (!view) return;
    if (messagesStore.hasNewerHistory(view.id)) await messagesStore.loadRecentHistory(view.id);
    if (deps.paneView()?.id === view.id) landOnBottom();
  }

  function jumpToUnread() {
    const view = deps.paneView();
    const anchor = unreadAnchor();
    if (view && anchor !== undefined) landOnDivider(view, anchor, false);
  }

  return {
    hasUnread: () => unreadAnchor() !== undefined,
    jumpToLatest,
    jumpToUnread,
    jumpToBeginning: () => landOnFirstMessage(messagesStore.jumpToBeginning),
    jumpToDate: (dateMs: number) =>
      landOnFirstMessage((viewId) => messagesStore.jumpToDate(viewId, dateMs)),
    jumpToMessage: feed.jumpTo,
    landedTs,
  };
}
