import type { CanvasCommentThread } from "@slock/types";
import { Button } from "@slock/ui";
import { For, Show } from "solid-js";
import { toggleReaction } from "../../lib/api";
import { flashCaughtError } from "../../lib/feedback";
import { store } from "../../lib/store";
import ReactionRow from "../messages/parts/ReactionRow";
import "./CanvasHistory.css";

const TAG_RE = /<[^>]*>/g;

function quoteOf(thread: CanvasCommentThread, html: string[]): string {
  for (const line of html) {
    const match = new RegExp(
      `<annotation id="[^"]*${thread.threadId}[^"]*">(.*?)</annotation>`,
    ).exec(line);
    if (match) return (match[1] ?? "").replace(TAG_RE, "");
  }
  return thread.quote;
}

export default function CanvasComments(props: {
  channelId: string;
  error: boolean;
  fileId: string;
  html: string[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  threads: CanvasCommentThread[];
}) {
  const me = () => store.users.currentUser()?.id;

  async function react(thread: CanvasCommentThread, name: string) {
    const mine = thread.reactions.find((r) => r.name === name)?.users.includes(me() ?? "");
    try {
      await toggleReaction(props.channelId, thread.ts, name, !!mine);
      props.onRefresh();
    } catch (error) {
      flashCaughtError(props.fileId, error, "Couldn't update the reaction");
    }
  }

  return (
    <aside aria-label="Comments" class="canvas-history surface-popover">
      <header class="canvas-history-header flex-between">
        <strong>Comments</strong>
        <Button onClick={props.onClose} size="sm">
          Done
        </Button>
      </header>
      <Show when={props.loading}>
        <div class="canvas-history-note text-dim">Loading…</div>
      </Show>
      <Show when={props.error}>
        <div class="canvas-history-note text-dim" role="alert">
          Couldn't load the comments.
        </div>
      </Show>
      <Show when={!(props.loading || props.error) && props.threads.length === 0}>
        <div class="canvas-history-note text-dim">
          No comments yet. Select text and use Comment to start one.
        </div>
      </Show>
      <ol class="canvas-history-list">
        <For each={props.threads}>
          {(thread) => (
            <li class="canvas-comment-thread flex-col">
              <button
                class="canvas-history-item btn-reset flex-col"
                onClick={() =>
                  store.viewState.openThread(props.channelId, thread.ts, undefined, {
                    pinned: true,
                  })
                }
                type="button"
              >
                <span class="canvas-comment-quote">{quoteOf(thread, props.html)}</span>
                <span class="canvas-history-author text-dim">
                  {thread.replyCount === 1 ? "1 reply" : `${thread.replyCount} replies`}
                </span>
              </button>
              <ReactionRow
                allowAdd
                feedbackKey={props.fileId}
                onToggle={(name) => void react(thread, name)}
                reactions={thread.reactions}
              />
            </li>
          )}
        </For>
      </ol>
    </aside>
  );
}
