import { Slot, service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import type { Pane } from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show, untrack } from "solid-js";
import { prepareReplyLink } from "../../../message-links/client/api/messageLinks";
import type { ThreadPaneContent } from "../../../messages/client/api";
import { createMessageFocus } from "../../../messages/client/api/messageFocus";
import ComposerGate from "../../../messages/client/api/pane/ComposerGate";
import InPaneSearchBar from "../../../messages/client/api/pane/InPaneSearchBar";
import { createInPaneSearch } from "../../../messages/client/api/pane/inPaneSearch";
import MessageRows from "../../../messages/client/api/pane/MessageRows";
import { createFeedPagination } from "../../../messages/client/api/pane/scroll/feedPagination";
import { createFeedScroll } from "../../../messages/client/api/pane/scroll/feedScroll";
import {
  getRememberedScrollAnchor,
  rememberScrollAnchor,
} from "../../../messages/client/api/pane/scroll/rememberedAnchors";
import ThreadHeader from "./ThreadHeader";
import ThreadJumpPills from "./ThreadJumpPills";
import { ThreadEarlierStatus, ThreadLoadStatus, ThreadMoreStatus } from "./ThreadLoadStatus";
import "./ThreadPane.css";

const feedback = service("feedback");
const messagesStore = service("messages");
const unreadStore = service("unread");

export default function ThreadPane(props: { pane: Pane<ThreadPaneContent> }) {
  const thread = () => props.pane.content;
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );

  const messages = createMemo(() => messagesStore.messagesInThread(thread().ts) ?? []);
  const hasMore = () =>
    messagesStore.hasMoreReplies(thread().ts) || messagesStore.missingReplies(thread().ts) > 0;

  const feed = createFeedScroll({
    isLive: () => !hasMore(),
    onMove: (direction) => {
      if (!feed.ready()) return;
      rememberScrollAnchor(
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
  const jumpToReplyTarget = () => feed.glideTo(replyTarget()?.ts ?? "");
  const cancelReply = () => setReplyTarget(null);

  createEffect(
    on(
      () => thread().ts,
      () => {
        feed.reset();
        pagination.reset();
        setReplyTarget(null);
      },
    ),
  );

  let handledFocusKey: string | undefined;
  createEffect(() => {
    const { channelId, highlightTs, ts } = thread();
    const key = `${ts}:${highlightTs ?? ""}`;
    if (handledFocusKey === key) return;
    const msgs = messages();
    const [first] = msgs;
    if (!first) return;
    const highlightMissing = highlightTs !== undefined && !msgs.some((m) => m.ts === highlightTs);
    if (highlightMissing) {
      untrack(() => messagesStore.ensureThreadRepliesLoaded(channelId, ts, highlightTs));
      if (messagesStore.isLoadingThread(ts)) return;
    }
    handledFocusKey = key;
    const found = highlightTs !== undefined && msgs.some((m) => m.ts === highlightTs);
    if (highlightTs && !found) feedback.flash("navigation", "Couldn't find that reply.", "error");
    const remembered = highlightTs ? undefined : getRememberedScrollAnchor(ts);
    if (found && highlightTs) {
      messageFocus.focusMessage(highlightTs);
      feed.land({ align: "center", at: "row", flash: true, ts: highlightTs });
    } else if (remembered && msgs.some((m) => m.ts === remembered.ts)) {
      feed.land({ at: "offset", offset: remembered.offset, ts: remembered.ts });
    } else {
      messageFocus.focusMessage(first.ts);
      feed.land({ align: "start", at: "row", ts: first.ts });
    }
  });

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

  createEffect(() => {
    const { ts } = thread();
    unreadStore.setBottomSeen(ts, feed.ready() && feed.atBottom() && !hasMore());
    onCleanup(() => unreadStore.setBottomSeen(ts, false));
  });

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
        aria-busy={messagesStore.isLoadingThread(thread().ts)}
        aria-hidden={pending()}
        class="thread-panel-messages"
        classList={{ "thread-panel-messages-pending": pending() }}
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
