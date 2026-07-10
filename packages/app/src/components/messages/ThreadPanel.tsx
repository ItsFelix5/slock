import type { Message } from "@slock/slack-api";
import { PanelHeader, ResizeHandle, showToast, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import {
  activeThread,
  channelById,
  channelDisplayName,
  closeThread,
  prepareReplyLink,
  threadMessages,
  typingUsersInThread,
} from "../../lib/store";
import Composer from "../composer/Composer";
import MessageRows from "./MessageRows";
import ReplyReferenceRow from "./ReplyReferenceRow";
import "./ThreadPanel.css";

const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;

export default function ThreadPanel() {
  const thread = activeThread;
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [replyTarget, setReplyTarget] = createSignal<{ ts: string; permalink: string } | null>(
    null,
  );
  let messagesRef: HTMLDivElement | undefined;

  const messages = createMemo(() => {
    const t = thread();
    if (!t) return [];
    return threadMessages[t.ts] ?? [];
  });

  const replyTargetMessage = createMemo(() => messages().find((m) => m.ts === replyTarget()?.ts));

  const typingNames = createMemo(() => {
    const t = thread();
    if (!t) return [];
    return typingUsersInThread(t.channelId, t.ts).map((u) => u.name);
  });

  createEffect(() => {
    thread();
    setReplyTarget(null);
  });

  const channelName = createMemo(() => {
    const t = thread();
    if (!t) return "";
    return channelDisplayName(channelById(t.channelId), t.channelId);
  });

  async function startReply(msg: Message) {
    const t = thread();
    if (!t) return;
    const permalink = await prepareReplyLink(t.channelId, msg.ts, t.ts);
    if (!permalink) {
      showToast("Failed to prepare reply link.");
      return;
    }
    setReplyTarget({ ts: msg.ts, permalink });
  }

  function jumpToMessage(ts: string) {
    const el = messagesRef?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("message-flash");
    setTimeout(() => el.classList.remove("message-flash"), 1500);
  }

  return (
    <Show when={thread()}>
      {(t) => (
        <div class="thread-panel" style={{ width: `${width()}px` }}>
          <ResizeHandle
            width={width}
            setWidth={setWidth}
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            direction={-1}
            side="left"
          />
          <PanelHeader onClose={closeThread}>
            <div>
              <div class="thread-panel-title">Thread</div>
              <div class="thread-panel-subtitle">#{channelName()}</div>
            </div>
          </PanelHeader>
          <div class="thread-panel-messages" ref={messagesRef}>
            <MessageRows
              messages={messages()}
              channelId={t().channelId}
              threadTs={t().ts}
              onReplyLink={startReply}
              onJumpToMessage={jumpToMessage}
            />
          </div>
          <TypingIndicator names={typingNames()} />
          <Show when={replyTarget()}>
            <div class="thread-reply-preview">
              <ReplyReferenceRow
                message={replyTargetMessage()}
                onJump={() => jumpToMessage(replyTarget()?.ts ?? "")}
              />
              <button
                type="button"
                class="thread-reply-preview-cancel"
                title="Cancel reply"
                onClick={() => setReplyTarget(null)}
              >
                ✕
              </button>
            </div>
          </Show>
          <Composer
            channelId={t().channelId}
            threadTs={t().ts}
            placeholder="Reply…"
            replyTo={(() => {
              const rt = replyTarget();
              return rt
                ? { permalink: rt.permalink, onSent: () => setReplyTarget(null) }
                : undefined;
            })()}
          />
        </div>
      )}
    </Show>
  );
}
