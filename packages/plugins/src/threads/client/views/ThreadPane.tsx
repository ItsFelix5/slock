import { Slot, service } from "@slock/core/solid";
import type { Message, Ts } from "@slock/types";
import { createResetSignal, type Pane } from "@slock/ui";
import { createEffect, createMemo, Show } from "solid-js";
import { prepareReplyLink } from "../../../message-links/client/api/messageLinks";
import type { ThreadPaneContent } from "../../../messages/client/api";
import { createMessageFocus } from "../../../messages/client/api/messageFocus";
import ComposerGate from "../../../messages/client/api/pane/ComposerGate";
import InPaneSearchBar from "../../../messages/client/api/pane/InPaneSearchBar";
import { createInPaneSearch } from "../../../messages/client/api/pane/inPaneSearch";
import MessageRows from "../../../messages/client/api/pane/MessageRows";
import { createFeedPagination } from "../../../messages/client/api/pane/scroll/feedPagination";
import { createFeedScroll } from "../../../messages/client/api/pane/scroll/feedScroll";
import { planThreadFocus } from "../lib/threadFocusPlan";
import ThreadHeader from "./ThreadHeader";
import ThreadJumpPills from "./ThreadJumpPills";
import { ThreadEarlierStatus, ThreadLoadStatus, ThreadMoreStatus } from "./ThreadLoadStatus";
import "./ThreadPane.css";

const feedback = service("feedback");
const messagesStore = service("messages");
const scrollAnchors = service("messages.anchors");
const unreadStore = service("unread");

export default function ThreadPane(props: { pane: Pane<ThreadPaneContent> }) {
  const thread = () => props.pane.content;
  const [replyTarget, setReplyTarget] = createResetSignal<{ ts: Ts; permalink: string } | null>(
    () => thread().ts,
    null,
  );

  const messages = createMemo(() => messagesStore.messagesInThread(thread().ts) ?? []);
  const hasMore = () =>
    messagesStore.hasMoreReplies(thread().ts) || messagesStore.missingReplies(thread().ts) > 0;

  const feed = createFeedScroll({
    isLive: () => !hasMore(),
    onMove: (direction) => {
      if (!feed.ready()) return;
      scrollAnchors.remember(
        thread().ts,
        feed.atBottom() && !hasMore() ? undefined : feed.topAnchor(),
      );
      pagination.check(direction);
    },
  });

  const loadEarlier = () => void messagesStore.loadEarlierReplies(thread().ts);
  const pagination = createFeedPagination({
    busy: () =>
      messagesStore.isLoadingThread(thread().ts) ||
      messagesStore.isLoadingMoreReplies(thread().ts) ||
      messagesStore.isLoadingEarlierReplies(thread().ts),
    canLoadNewer: () =>
      messagesStore.hasMoreReplies(thread().ts) && !messagesStore.hasMoreRepliesError(thread().ts),
    canLoadOlder: () =>
      messagesStore.hasEarlierReplies(thread().ts) &&
      !messagesStore.hasEarlierRepliesError(thread().ts),
    loadNewer: () => void messagesStore.loadMoreReplies(thread().ts),
    loadOlder: loadEarlier,
    ready: feed.ready,
    scroller: feed.element,
    size: () => messages().length,
  });

  const messageFocus = createMessageFocus(messages, feed, () => thread().channelId, {
    paneId: props.pane.id,
    onReplyLink: (msg) => void startReply(msg),
    threadTs: () => thread().ts,
  });
  const inPaneSearch = createInPaneSearch(messages, feed, () => props.pane.id);
  const pending = () => !feed.ready() && messages().length > 0;

  const replyTargetMessage = () => messages().find((m) => m.ts === replyTarget()?.ts);
  const jumpToReplyTarget = () => {
    const target = replyTarget();
    if (target) feed.glideTo(target.ts);
  };
  const cancelReply = () => setReplyTarget(null);

  createEffect(
    () => thread().ts,
    () => {
      feed.reset();
      pagination.reset();
    },
  );

  let handledFocusKey: string | undefined;
  createEffect(
    () => {
      const { channelId, highlightTs, ts } = thread();
      return {
        channelId,
        highlightTs,
        loading: messagesStore.isLoadingThread(ts),
        msgs: messages(),
        ts,
      };
    },
    ({ channelId, highlightTs, loading, msgs, ts }) => {
      const input = {
        handledKey: handledFocusKey,
        highlightTs,
        loading,
        messages: msgs,
        remembered: scrollAnchors.get(ts),
        repliesExhausted: false,
        ts,
      };
      let step = planThreadFocus(input);
      if (step.kind === "load-replies") {
        if (messagesStore.ensureThreadRepliesLoaded(channelId, ts, highlightTs)) return;
        step = planThreadFocus({ ...input, repliesExhausted: true });
      }
      if (step.kind !== "land") return;
      handledFocusKey = step.key;
      if (step.missingHighlight) feedback.flash("navigation", "Couldn't find that reply.", "error");
      const { landing } = step;
      if (landing.at === "highlight") {
        messageFocus.focusMessage(landing.ts);
        feed.land({ align: "center", at: "row", flash: true, ts: landing.ts });
      } else if (landing.at === "remembered") {
        feed.land({ at: "offset", offset: landing.offset, ts: landing.ts });
      } else {
        messageFocus.focusMessage(landing.ts);
        feed.land({ align: "start", at: "row", ts: landing.ts });
      }
    },
  );

  async function startReply(msg: Message) {
    const t = thread();
    const permalink = await prepareReplyLink(t.channelId, msg.ts, t.ts);
    if (thread() !== t) return;
    if (!permalink) {
      feedback.flash(msg.ts, "Failed to prepare reply link.", "error");
      return;
    }
    setReplyTarget({ permalink, ts: msg.ts });
  }

  unreadStore.trackBottomSeen(
    () => thread().ts,
    () => feed.ready() && feed.atBottom() && !hasMore(),
  );

  return (
    <div class="thread-panel flex-col" data-pane={props.pane.id}>
      <ThreadHeader
        channelId={thread().channelId}
        hasMessages={messages().length > 0}
        paneId={props.pane.id}
        threadTs={thread().ts}
      />
      <ThreadLoadStatus hasMessages={messages().length > 0} ts={thread().ts} />
      <div
        aria-busy={messagesStore.isLoadingThread(thread().ts) ? "true" : "false"}
        aria-hidden={pending() ? "true" : "false"}
        class={["thread-panel-messages", { "thread-panel-messages-pending": pending() }]}
        onFocusIn={messageFocus.onContainerFocusIn}
        onFocusOut={messageFocus.onContainerFocusOut}
        ref={feed.attach}
      >
        <Show when={inPaneSearch.open()}>
          <InPaneSearchBar
            matchCount={inPaneSearch.matchCount()}
            matchIndex={inPaneSearch.matchIndex()}
            onClose={inPaneSearch.close}
            onNext={inPaneSearch.goNext}
            onPrev={inPaneSearch.goPrev}
            onQueryInput={inPaneSearch.setQuery}
            query={inPaneSearch.query()}
          />
        </Show>
        <MessageRows
          channelId={thread().channelId}
          editingTs={messageFocus.editingTs}
          focusedTs={messageFocus.focusedTs}
          messages={messages()}
          moreMenuTs={messageFocus.moreMenuTs}
          onJumpToMessage={feed.glideTo}
          onReplyLink={startReply}
          onStartEdit={messageFocus.onStartEdit}
          onStopEdit={messageFocus.onStopEdit}
          onToggleMoreMenu={messageFocus.onToggleMoreMenu}
          onToggleReactionPicker={messageFocus.onToggleReactionPicker}
          reactionPickerTs={messageFocus.reactionPickerTs}
          gap={<ThreadEarlierStatus onRetry={loadEarlier} ts={thread().ts} />}
          gapAfterTs={messagesStore.hasEarlierReplies(thread().ts) ? thread().ts : undefined}
          threadTs={thread().ts}
        />
        <ThreadMoreStatus ts={thread().ts} />
      </div>
      <ThreadJumpPills
        atBottom={feed.atBottom() && !hasMore()}
        atTop={feed.atTop()}
        onFirst={() => messageFocus.focusEdge("start")}
        onLatest={() => messageFocus.focusEdge("end")}
      />
      <div class="typing-indicator-anchor composer-overlay">
        <Slot channelId={thread().channelId} point="messages.footer" threadTs={thread().ts} />
        <ComposerGate channelId={thread().channelId} locked={messages()[0]?.isLocked}>
          <Show keyed when={thread().ts}>
            <Slot
              channelId={thread().channelId}
              paneId={props.pane.id}
              placeholder="Reply…"
              point="composer.input"
              replyTo={(() => {
                const rt = replyTarget();
                return rt
                  ? {
                      message: replyTargetMessage(),
                      onCancel: cancelReply,
                      onJump: jumpToReplyTarget,
                      onSent: cancelReply,
                      permalink: rt.permalink,
                    }
                  : undefined;
              })()}
              threadTs={thread().ts}
            />
          </Show>
        </ComposerGate>
      </div>
    </div>
  );
}
