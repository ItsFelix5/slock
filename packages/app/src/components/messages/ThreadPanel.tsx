import type { Message } from "@slock/slack-api";
import { Icon, PanelHeader, ResizeHandle, Tooltip, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import Composer from "../composer/Composer";
import MessageRows from "./MessageRows";
import ReplyReferenceRow from "./parts/ReplyReferenceRow";
import "./ThreadPanel.css";

const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;

export default function ThreadPanel() {
  const thread = store.viewState.activeThread;
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let messagesRef: HTMLDivElement | undefined;
  const messages = createMemo(() => {
    const t = thread();
    if (!t) return [];
    return store.messages.threadMessages[t.ts] ?? [];
  });

  const replyTargetMessage = createMemo(() => messages().find((m) => m.ts === replyTarget()?.ts));

  const typingNames = createMemo(() => {
    const t = thread();
    if (!t) return [];
    return store.typing.typingUsersInThread(t.channelId, t.ts).map((u) => u.name);
  });

  const toggleSubscription = () => {
    const t = thread();
    if (t) store.messages.toggleThreadSubscribed(t.channelId, t.ts);
  };
  const jumpToReplyTarget = () => jumpToMessage(replyTarget()?.ts ?? "");
  const cancelReply = () => setReplyTarget(null);
  const openThreadMessageInChannel = () => {
    const t = thread();
    if (t) store.viewState.openChannelMessage(t.channelId, t.ts);
  };

  createEffect(() => {
    thread();
    setReplyTarget(null);
  });

  // Opening a thread via a specific reply (e.g. from Later) resolves to the
  // thread root, so once that reply loads in, scroll to and flash it rather
  // than leaving the reader at the top of the thread.
  // Track the navigation request itself, rather than just its timestamps. A
  // Later item can be clicked again while this thread is already open; that
  // creates a fresh ThreadRef with the same values and should jump again.
  let handledHighlightRequest: ReturnType<typeof thread> = null;
  createEffect(() => {
    const t = thread();
    if (!t?.highlightTs) return;
    if (handledHighlightRequest === t) return;
    if (!messages().some((m) => m.ts === t.highlightTs)) return;
    handledHighlightRequest = t;
    queueMicrotask(() => jumpToMessage(t.highlightTs ?? ""));
  });

  const channelName = createMemo(() => {
    const t = thread();
    if (!t) return "";
    return channelDisplayName(store.channels.channelById(t.channelId), t.channelId);
  });

  async function startReply(msg: Message) {
    const t = thread();
    if (!t) return;
    const permalink = await store.messages.prepareReplyLink(t.channelId, msg.ts, t.ts);
    if (!permalink) {
      actionFeedback.flash(msg.ts, "Failed to prepare reply link.", "error");
      return;
    }
    setReplyTarget({ permalink, ts: msg.ts });
  }

  function jumpToMessage(ts: string) {
    const el = messagesRef?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("message-flash");
    setTimeout(() => el.classList.remove("message-flash"), 1500);
  }

  return (
    <Show when={thread()}>
      {(t) => (
        <div class="thread-panel" style={{ width: `${width()}px` }}>
          <ResizeHandle
            direction={-1}
            max={MAX_WIDTH}
            min={MIN_WIDTH}
            setWidth={setWidth}
            side="left"
            width={width}
          />
          <PanelHeader onClose={store.viewState.closeThread}>
            <div class="thread-panel-header-info flex-align-center">
              <div class="thread-panel-title">Thread</div>
              <button
                aria-label={`View thread message in #${channelName()}`}
                class="thread-panel-subtitle btn-reset"
                onClick={openThreadMessageInChannel}
                type="button"
              >
                #{channelName()}
              </button>
              <Tooltip
                content={
                  store.messages.isThreadSubscribed(t().ts)
                    ? "Unfollow thread"
                    : "Get notified about new replies"
                }
              >
                <button
                  aria-label={
                    store.messages.isThreadSubscribed(t().ts)
                      ? "Unfollow thread"
                      : "Get notified about new replies"
                  }
                  class="thread-panel-subscribe-btn btn-reset flex-center"
                  classList={{ subscribed: store.messages.isThreadSubscribed(t().ts) }}
                  onClick={toggleSubscription}
                  type="button"
                >
                  <Icon
                    name={
                      store.messages.isThreadSubscribed(t().ts)
                        ? "notifications-check"
                        : "notifications"
                    }
                    size={16}
                  />
                </button>
              </Tooltip>
            </div>
          </PanelHeader>
          <Show
            fallback={
              <div class="thread-panel-error text-dim">
                Can't load this thread — you may not have access to it.
              </div>
            }
            when={!(store.messages.hasThreadError(t().ts) && messages().length === 0)}
          >
            <div class="thread-panel-messages" ref={messagesRef}>
              <MessageRows
                channelId={t().channelId}
                messages={messages()}
                onJumpToMessage={jumpToMessage}
                onReplyLink={startReply}
                threadTs={t().ts}
              />
            </div>
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
                    <Icon name="close" size={12} />
                  </button>
                </Tooltip>
              </div>
            </Show>
            <Composer
              channelId={t().channelId}
              placeholder="Reply…"
              replyTo={(() => {
                const rt = replyTarget();
                return rt
                  ? { onSent: () => setReplyTarget(null), permalink: rt.permalink }
                  : undefined;
              })()}
              threadTs={t().ts}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}
