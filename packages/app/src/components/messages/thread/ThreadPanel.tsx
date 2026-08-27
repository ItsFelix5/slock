import { Button, Icon, type Pane, PanelHeader, Tooltip, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import type { Message } from "../../../lib/api";
import { conversationDisplayName } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { prepareReplyLink } from "../../../lib/messageLinks";
import { closeTile } from "../../../lib/paneActions";
import { store } from "../../../lib/store";
import type { ThreadPaneContent } from "../../../lib/store/slices/types";
import Composer from "../../composer/Composer";
import InPaneSearchBar from "../InPaneSearchBar";
import { createInPaneSearch } from "../inPaneSearch";
import MessageRows from "../MessageRows";
import { createMessageFocus } from "../messageFocus";
import ReplyReferenceRow from "../parts/ReplyReferenceRow";
import { isScrolledToBottom, jumpToMessageInContainer, scrollToBottom } from "../scrollAnchor";
import "./ThreadPanel.css";

export default function ThreadPanel(props: { pane: Pane<ThreadPaneContent> }) {
  const thread = () => props.pane.content;
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );

  let messagesRef: HTMLDivElement | undefined;
  let cancelJump: (() => void) | undefined;
  const messages = createMemo(() => store.messages.threadMessages[thread().ts] ?? []);
  const messageFocus = createMessageFocus(
    messages,
    () => messagesRef,
    () => thread().channelId,
    {
      onReplyLink: (msg) => void startReply(msg),
      threadTs: () => thread().ts,
    },
  );

  const replyTargetMessage = createMemo(() => messages().find((m) => m.ts === replyTarget()?.ts));
  const inPaneSearch = createInPaneSearch(
    messages,
    () => messagesRef,
    () => props.pane.id,
  );

  const typingNames = createMemo(() => {
    const t = thread();
    return store.typing.typingUsersInThread(t.channelId, t.ts).map((u) => u.name);
  });

  const toggleSubscription = () => {
    const t = thread();
    store.messages.toggleThreadSubscribed(t.channelId, t.ts);
  };
  const jumpToReplyTarget = () => jumpToMessage(replyTarget()?.ts ?? "");
  const cancelReply = () => setReplyTarget(null);
  const openThreadMessageInChannel = () => {
    const t = thread();
    store.viewState.openChannelMessage(t.channelId, t.ts, { keepNav: true });
  };

  createEffect(() => {
    thread();
    cancelJump?.();
    cancelJump = undefined;
    setReplyTarget(null);
  });
  onCleanup(() => cancelJump?.());

  let handledHighlightRequest: ThreadPaneContent | null = null;
  let highlightedRequestJustHandled: ThreadPaneContent | null = null;
  createEffect(() => {
    const t = thread();
    if (!t.highlightTs) return;
    if (handledHighlightRequest === t) return;
    if (!messages().some((m) => m.ts === t.highlightTs)) return;
    handledHighlightRequest = t;
    highlightedRequestJustHandled = t;
    queueMicrotask(() => jumpToMessage(t.highlightTs ?? ""));
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

    if (highlightedRequestJustHandled === t) {
      highlightedRequestJustHandled = null;
      shouldFollowBottom = false;
      return;
    }
    if (t.highlightTs && handledHighlightRequest !== t) return;

    if (shouldFollowBottom) {
      queueMicrotask(() => {
        if (!messagesRef) return;
        scrollToBottom(messagesRef);
        shouldFollowBottom = isScrolledToBottom(messagesRef);
      });
    }
  });

  createEffect(() => {
    messages();
    const el = messagesRef;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (shouldFollowBottom) scrollToBottom(el);
    });
    for (const row of el.querySelectorAll<HTMLElement>("[data-message-ts]")) observer.observe(row);
    onCleanup(() => observer.disconnect());
  });

  const channelName = createMemo(() =>
    conversationDisplayName(
      thread().channelId,
      store.channels.channelById,
      store.dms.dmById,
      store.users.userById,
    ),
  );

  async function startReply(msg: Message) {
    const t = thread();
    const permalink = await prepareReplyLink(t.channelId, msg.ts, t.ts);
    if (thread() !== t) return;
    if (!permalink) {
      actionFeedback.flash(msg.ts, "Failed to prepare reply link.", "error");
      return;
    }
    setReplyTarget({ permalink, ts: msg.ts });
  }

  function jumpToMessage(ts: string) {
    if (!messagesRef) return;
    cancelJump?.();
    cancelJump = jumpToMessageInContainer(messagesRef, ts);
  }

  function handleMessagesScroll() {
    if (messagesRef) shouldFollowBottom = isScrolledToBottom(messagesRef);
  }

  return (
    <div class="thread-panel" data-pane={props.pane.id}>
      <PanelHeader
        canClose={store.panes.panes().length > 1}
        onClose={() => closeTile(props.pane.id)}
      >
        <div class="thread-panel-header-info flex-align-center">
          <div class="thread-panel-title">Thread</div>
          <button
            aria-label={`View thread message in ${channelName()}`}
            class="thread-panel-subtitle btn-reset flex-align-center"
            onClick={openThreadMessageInChannel}
            type="button"
          >
            {channelName()}
          </button>
          <Tooltip
            content={
              store.messages.isThreadSubscribed(thread().ts)
                ? "Unfollow thread"
                : "Get notified about new replies"
            }
          >
            <button
              class="thread-panel-subscribe-btn btn-reset flex-center"
              classList={{ subscribed: store.messages.isThreadSubscribed(thread().ts) }}
              disabled={
                messages().length === 0 ||
                store.messages.isThreadSubscriptionPending(thread().channelId, thread().ts)
              }
              onClick={toggleSubscription}
              type="button"
            >
              <Icon
                name={
                  store.messages.isThreadSubscribed(thread().ts)
                    ? "notifications-check"
                    : "notifications"
                }
                size={16}
              />
            </button>
          </Tooltip>
        </div>
      </PanelHeader>
      <Show when={store.messages.isLoadingThread(thread().ts) && messages().length === 0}>
        <div class="thread-panel-status text-dim">Loading thread…</div>
      </Show>
      <Show when={store.messages.hasThreadError(thread().ts)}>
        <div class="thread-panel-error">
          <span>Couldn't load this thread.</span>
          <Button
            onClick={() =>
              store.messages.ensureThreadRepliesLoaded(thread().channelId, thread().ts)
            }
            size="sm"
          >
            Try again
          </Button>
        </div>
      </Show>
      <div
        aria-busy={store.messages.isLoadingThread(thread().ts)}
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
          onJumpToMessage={jumpToMessage}
          onReplyLink={startReply}
          onStartEdit={messageFocus.onStartEdit}
          onStopEdit={messageFocus.onStopEdit}
          threadTs={thread().ts}
        />
      </div>
      <div class="typing-indicator-anchor">
        <TypingIndicator names={typingNames()} />
        <Show when={replyTarget()}>
          <div class="thread-reply-preview flex-align-center">
            <ReplyReferenceRow message={replyTargetMessage()} onJump={jumpToReplyTarget} />
            <Tooltip content="Cancel reply">
              <button
                aria-label="Cancel reply"
                class="thread-reply-preview-cancel btn-reset flex-center"
                onClick={cancelReply}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            </Tooltip>
          </div>
        </Show>
        <Composer
          channelId={thread().channelId}
          paneId={props.pane.id}
          placeholder="Reply…"
          replyTo={(() => {
            const rt = replyTarget();
            return rt ? { onSent: () => setReplyTarget(null), permalink: rt.permalink } : undefined;
          })()}
          threadTs={thread().ts}
        />
      </div>
    </div>
  );
}
