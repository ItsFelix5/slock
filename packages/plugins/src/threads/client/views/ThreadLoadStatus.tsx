import { service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import { Show } from "solid-js";

const messagesStore = service("messages");

export function ThreadLoadStatus(props: { hasMessages: boolean; ts: string }) {
  return (
    <>
      <Show when={messagesStore.isLoadingThread(props.ts) && !props.hasMessages}>
        <div class="thread-panel-status text-dim">Loading thread…</div>
      </Show>
      <Show when={messagesStore.hasThreadError(props.ts)}>
        <div class="thread-panel-error flex-center">
          <span>Couldn't load this thread.</span>
          <Button onClick={() => void messagesStore.refreshThreadReplies(props.ts)} size="sm">
            Try again
          </Button>
        </div>
      </Show>
    </>
  );
}

export function ThreadMoreStatus(props: { ts: string }) {
  return (
    <>
      <Show when={messagesStore.isLoadingMoreReplies(props.ts)}>
        <div aria-live="polite" class="thread-panel-status text-dim">
          Loading replies…
        </div>
      </Show>
      <Show when={messagesStore.hasMoreRepliesError(props.ts)}>
        <div class="thread-panel-more-error flex-center">
          <span>Couldn't load more replies.</span>
          <Button onClick={() => void messagesStore.loadMoreReplies(props.ts)} size="sm">
            Try again
          </Button>
        </div>
      </Show>
    </>
  );
}

export function ThreadEarlierStatus(props: { onRetry: () => void; ts: string }) {
  return (
    <div class="thread-panel-earlier flex-center text-dim">
      <Show
        fallback={
          <Show when={messagesStore.isLoadingEarlierReplies(props.ts)}>
            <span aria-live="polite">Loading earlier replies…</span>
          </Show>
        }
        when={messagesStore.hasEarlierRepliesError(props.ts)}
      >
        <span>Couldn't load earlier replies.</span>
        <Button onClick={props.onRetry} size="sm">
          Try again
        </Button>
      </Show>
    </div>
  );
}
