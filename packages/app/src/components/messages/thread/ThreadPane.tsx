import type { Message } from "@slock/types";
import { Button, Icon, IconButton, type Pane, PanelHeader, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { conversationDisplayName } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { prepareReplyLink } from "../../../lib/messageLinks";
import { openConversationInSplit } from "../../../lib/navigation/conversationNav";
import { store } from "../../../lib/store";
import type { ThreadPaneContent } from "../../../lib/store/slices/types";
import JoinChannelBar from "../../channel/JoinChannelBar";
import Composer from "../../composer/Composer";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import { observeComposerOverlay } from "../composerOverlay";
import InPaneSearchBar from "../InPaneSearchBar";
import { createInPaneSearch } from "../inPaneSearch";
import MessageRows from "../MessageRows";
import { createMessageFocus } from "../messageFocus";
import {
  captureScrollAnchor,
  getRememberedScrollAnchor,
  isScrolledToBottom,
  jumpToMessageInContainer,
  rememberScrollAnchor,
  restoreScrollAnchor,
  scrollToBottom,
} from "../scrollAnchor";
import "./ThreadPane.css";

export default function ThreadPane(props: { pane: Pane<ThreadPaneContent> }) {
  const thread = () => props.pane.content;
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );

  const [edges, setEdges] = createSignal({ atBottom: true, atTop: true });

  let messagesRef: HTMLDivElement | undefined;
  let cancelJump: (() => void) | undefined;
  const messages = createMemo(() => store.messages.messagesInThread(thread().ts) ?? []);
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

  const typingNames = createMemo(() => {
    const t = thread();
    return store.typing.typingUsersInThread(t.channelId, t.ts).map((u) => u.name);
  });

  const isMember = () => store.channels.isChannelMember(thread().channelId);
  const toggleSubscription = () => {
    const t = thread();
    if (!isMember()) return;
    store.messages.toggleThreadSubscribed(t.channelId, t.ts);
  };
  const jumpToReplyTarget = () => jumpToMessage(replyTarget()?.ts ?? "");
  const cancelReply = () => setReplyTarget(null);
  const openThreadMessageInChannel = () => {
    const t = thread();
    store.viewState.openChannelMessage(t.channelId, t.ts);
  };

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
  let refreshedFocusKey: string | undefined;
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
    if (highlightMissing && store.messages.isLoadingThread(ts)) return;
    if (highlightMissing && refreshedFocusKey !== key) {
      refreshedFocusKey = key;
      void store.messages.ensureThreadMessage(thread().channelId, ts, highlightTs);
      return;
    }
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
    if (!messagesRef) return;
    shouldFollowBottom = isScrolledToBottom(messagesRef);
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
      <PanelHeader
        canClose={store.viewState.canCloseTile()}
        onClose={() => store.viewState.closeTile(props.pane.id)}
      >
        <div class="thread-panel-header-info flex-align-center">
          <div class="thread-panel-title">Thread</div>
          <SplitNavigation onSplit={() => openConversationInSplit(thread().channelId, thread().ts)}>
            <button
              aria-label={`View thread message in ${channelName()}`}
              class="thread-panel-subtitle btn-reset flex-align-center truncate"
              onClick={openThreadMessageInChannel}
              type="button"
            >
              {channelName()}
            </button>
          </SplitNavigation>
          <IconButton
            class="thread-panel-subscribe-btn icon-shift"
            classList={{ subscribed: store.messages.isThreadSubscribed(thread().ts) }}
            disabled={
              !isMember() ||
              messages().length === 0 ||
              store.messages.isThreadSubscriptionPending(thread().channelId, thread().ts)
            }
            icon={
              store.messages.isThreadSubscribed(thread().ts)
                ? "notifications-check"
                : "notifications"
            }
            label={
              isMember()
                ? store.messages.isThreadSubscribed(thread().ts)
                  ? "Unfollow thread"
                  : "Get notified about new replies"
                : "Join the channel to get notified"
            }
            onClick={toggleSubscription}
          />
        </div>
      </PanelHeader>
      <Show when={store.messages.isLoadingThread(thread().ts) && messages().length === 0}>
        <div class="thread-panel-status text-dim">Loading thread…</div>
      </Show>
      <Show when={store.messages.hasThreadError(thread().ts)}>
        <div class="thread-panel-error flex-center">
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
      <Show when={!edges().atTop}>
        <button
          class="thread-panel-jump thread-panel-jump-top message-list-date-pill surface-popover btn-reset"
          onClick={() => messageFocus.focusEdge("start")}
          type="button"
        >
          <Icon name="arrow-up" size={12} />
          First message
        </button>
      </Show>
      <Show when={!edges().atBottom}>
        <button
          class="thread-panel-jump thread-panel-jump-bottom message-list-date-pill surface-popover btn-reset"
          onClick={() => messageFocus.focusEdge("end")}
          type="button"
        >
          <Icon name="arrow-down" size={12} />
          Latest reply
        </button>
      </Show>
      <div class="typing-indicator-anchor composer-overlay">
        <TypingIndicator names={typingNames()} />
        <Show fallback={<JoinChannelBar channelId={thread().channelId} />} when={isMember()}>
          <Show keyed when={thread().ts}>
            <Composer
              channelId={thread().channelId}
              paneId={props.pane.id}
              placeholder="Reply…"
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
        </Show>
      </div>
    </div>
  );
}
