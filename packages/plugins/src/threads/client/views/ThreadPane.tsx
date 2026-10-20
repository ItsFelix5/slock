import { Slot, service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { Button, type Pane } from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { prepareReplyLink } from "../../../message-links/client/api/messageLinks";
import type { ThreadPaneContent } from "../../../messages/client/api";
import { createMessageFocus } from "../../../messages/client/api/messageFocus";
import ComposerGate from "../../../messages/client/api/pane/ComposerGate";
import { observeComposerOverlay } from "../../../messages/client/api/pane/composerOverlay";
import InPaneSearchBar from "../../../messages/client/api/pane/InPaneSearchBar";
import { createInPaneSearch } from "../../../messages/client/api/pane/inPaneSearch";
import MessageRows from "../../../messages/client/api/pane/MessageRows";
import {
  captureScrollAnchor,
  getRememberedScrollAnchor,
  isScrolledToBottom,
  jumpToMessageInContainer,
  rememberScrollAnchor,
  restoreScrollAnchor,
  scrollToBottom,
} from "../../../messages/client/api/pane/scrollAnchor";
import ThreadHeader from "./ThreadHeader";
import ThreadJumpPills from "./ThreadJumpPills";
import "./ThreadPane.css";

const feedback = service("feedback");

const messagesStore = service("messages");
const unreadStore = service("unread");

export default function ThreadPane(props: { pane: Pane<ThreadPaneContent> }) {
  const thread = () => props.pane.content;
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );

  const [edges, setEdges] = createSignal({ atBottom: true, atTop: true });

  let messagesRef: HTMLDivElement | undefined;
  let cancelJump: (() => void) | undefined;
  const messages = createMemo(() => messagesStore.messagesInThread(thread().ts) ?? []);
  const messageFocus = createMessageFocus(
    messages,
    () => messagesRef,
    () => thread().channelId,
    {
      onReplyLink: (msg) => void startReply(msg),
      threadTs: () => thread().ts,
    },
  );

  const replyTargetMessage = () => messages().find((m) => m.ts === replyTarget()?.ts);
  const inPaneSearch = createInPaneSearch(
    messages,
    () => messagesRef,
    () => props.pane.id,
  );

  const jumpToReplyTarget = () => jumpToMessage(replyTarget()?.ts ?? "");
  const cancelReply = () => setReplyTarget(null);

  createEffect(
    on(
      () => thread().ts,
      () => {
        cancelJump?.();
        cancelJump = undefined;
        setReplyTarget(null);
      },
    ),
  );
  onCleanup(() => cancelJump?.());
  createEffect(() => {
    if (!messagesRef) return;
    onCleanup(observeComposerOverlay(messagesRef, () => shouldFollowBottom));
  });

  let handledFocusKey: string | undefined;
  let readyTs: string | undefined;
  let justHandledTs: string | undefined;
  createEffect(() => {
    const { highlightTs, ts } = thread();
    const key = `${ts}:${highlightTs ?? ""}`;
    if (handledFocusKey === key) return;
    const msgs = messages();
    const [first] = msgs;
    if (!first) return;
    const highlightMissing = highlightTs !== undefined && !msgs.some((m) => m.ts === highlightTs);
    if (highlightMissing && messagesStore.isLoadingThread(ts)) return;
    handledFocusKey = key;
    readyTs = ts;
    justHandledTs = ts;

    if (highlightTs) {
      const targetTs = msgs.some((m) => m.ts === highlightTs) ? highlightTs : first.ts;
      queueMicrotask(() => {
        jumpToMessage(targetTs);
        messageFocus.focusMessage(targetTs);
      });
      return;
    }

    const remembered = getRememberedScrollAnchor(ts);
    if (remembered && msgs.some((m) => m.ts === remembered.ts)) {
      queueMicrotask(() => {
        if (!messagesRef) return;
        const row = messagesRef.querySelector<HTMLElement>(
          `[data-message-ts="${CSS.escape(remembered.ts)}"]`,
        );
        if (row) restoreScrollAnchor(messagesRef, { el: row, offset: remembered.offset });
        else jumpToMessage(first.ts);
      });
      return;
    }

    const firstTs = first.ts;
    queueMicrotask(() => {
      jumpToMessage(firstTs);
      messageFocus.focusMessage(firstTs);
    });
  });

  let lastThreadTs: string | undefined;
  let shouldFollowBottom = true;
  createEffect(() => {
    const t = thread();
    const msgs = messages();
    const switchedThread = t.ts !== lastThreadTs;
    lastThreadTs = t.ts;
    if (switchedThread) shouldFollowBottom = true;
    if (!(messagesRef && msgs.length > 0)) return;

    if (justHandledTs === t.ts) {
      justHandledTs = undefined;
      shouldFollowBottom = false;
      return;
    }
    if (readyTs !== t.ts) return;

    if (shouldFollowBottom) {
      queueMicrotask(() => {
        if (!messagesRef) return;
        scrollToBottom(messagesRef);
        shouldFollowBottom = isScrolledToBottom(messagesRef);
      });
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

  function jumpToMessage(ts: string) {
    if (!messagesRef) return;
    cancelJump?.();
    cancelJump = jumpToMessageInContainer(messagesRef, ts);
  }

  function reportBottomSeen() {
    if (messagesRef)
      unreadStore.setBottomSeen(
        thread().ts,
        readyTs === thread().ts && isScrolledToBottom(messagesRef),
      );
  }
  createEffect(() => {
    const { ts } = thread();
    messages();
    queueMicrotask(reportBottomSeen);
    onCleanup(() => unreadStore.setBottomSeen(ts, false));
  });

  function handleMessagesScroll() {
    if (!messagesRef) return;
    shouldFollowBottom = isScrolledToBottom(messagesRef);
    reportBottomSeen();
    setEdges({
      atBottom: shouldFollowBottom,
      atTop: messagesRef.scrollTop <= messagesRef.clientHeight / 2,
    });
    if (readyTs !== thread().ts) return;
    const anchor = captureScrollAnchor(messagesRef);
    const ts = anchor?.el.dataset.messageTs;
    if (anchor && ts) rememberScrollAnchor(thread().ts, { offset: anchor.offset, ts });
  }

  return (
    <div class="thread-panel flex-col" data-pane={props.pane.id}>
      <ThreadHeader
        channelId={thread().channelId}
        hasMessages={messages().length > 0}
        paneId={props.pane.id}
        threadTs={thread().ts}
      />
      <Show when={messagesStore.isLoadingThread(thread().ts) && messages().length === 0}>
        <div class="thread-panel-status text-dim">Loading thread…</div>
      </Show>
      <Show when={messagesStore.hasThreadError(thread().ts)}>
        <div class="thread-panel-error flex-center">
          <span>Couldn't load this thread.</span>
          <Button
            onClick={() => messagesStore.ensureThreadRepliesLoaded(thread().channelId, thread().ts)}
            size="sm"
          >
            Try again
          </Button>
        </div>
      </Show>
      <div
        aria-busy={messagesStore.isLoadingThread(thread().ts)}
        class="thread-panel-messages"
        onFocusIn={messageFocus.onContainerFocusIn}
        onFocusOut={messageFocus.onContainerFocusOut}
        onScroll={handleMessagesScroll}
        ref={messagesRef}
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
          onJumpToMessage={jumpToMessage}
          onReplyLink={startReply}
          onStartEdit={messageFocus.onStartEdit}
          onStopEdit={messageFocus.onStopEdit}
          onToggleMoreMenu={messageFocus.onToggleMoreMenu}
          onToggleReactionPicker={messageFocus.onToggleReactionPicker}
          reactionPickerTs={messageFocus.reactionPickerTs}
          threadTs={thread().ts}
        />
      </div>
      <ThreadJumpPills
        atBottom={edges().atBottom}
        atTop={edges().atTop}
        onFirst={() => messageFocus.focusEdge("start")}
        onLatest={() => messageFocus.focusEdge("end")}
      />
      <div class="typing-indicator-anchor composer-overlay">
        <Slot channelId={thread().channelId} point="messages.footer" threadTs={thread().ts} />
        <ComposerGate channelId={thread().channelId}>
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
