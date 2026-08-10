import { Mrkdwn } from "@slock/blockkit";
import { Button, IconButton, InlineFeedback } from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import {
  openConversationInSplit,
  SplitNavigation,
} from "../../components/navigation/SplitNavigation";
import { actionFeedback, conversationDisplayName, store } from "../../lib/store";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => store.later.ensureLaterLoaded());

  const goTo = (channelId: string, ts: string, highlightTs?: string) =>
    store.viewState.openChannelPeek(channelId, ts, highlightTs, { keepNav: true });

  return (
    <div class="later-view sidebar-view-panel">
      <h2>Later</h2>
      <Show
        fallback={
          <div class="later-empty empty-state" role="status">
            Loading saved items…
          </div>
        }
        when={store.later.laterLoaded() || store.later.laterLoadError()}
      >
        <Show
          fallback={
            <div class="later-load-error empty-state flex-col" role="alert">
              <span>Couldn’t load saved items.</span>
              <Button onClick={store.later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          }
          when={store.later.laterLoaded() || !store.later.laterLoadError()}
        >
          <Show when={store.later.laterLoading() && store.later.laterLoaded()}>
            <div class="later-load-notice text-dim text-sm" role="status">
              Refreshing saved items…
            </div>
          </Show>
          <Show when={store.later.laterLoadError() && store.later.laterLoaded()}>
            <div class="later-load-notice later-load-warning" role="alert">
              <span>Couldn’t refresh saved items.</span>
              <Button onClick={store.later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          </Show>
          <Show
            fallback={<div class="later-empty empty-state">Nothing saved for later.</div>}
            when={store.later.laterItems.length > 0}
          >
            <For each={store.later.laterItems}>
              {(item) => {
                const key = `${item.channelId}:${item.ts}`;
                onMount(() => store.later.ensureLaterMessageLoaded(item));
                const isLoaded = createMemo(() => key in store.later.laterMessages);
                const isLoading = createMemo(() =>
                  store.later.isLaterMessageLoading(item.channelId, item.ts),
                );
                const loadError = createMemo(() =>
                  store.later.hasLaterMessageError(item.channelId, item.ts),
                );
                const msg = createMemo(() => store.later.laterMessages[key]);
                // channelById triggers a network discovery lookup for unknown
                // ids — skip it for DM ids, which will never resolve as a channel.
                const channel = createMemo(() =>
                  item.channelId.startsWith("D")
                    ? undefined
                    : store.channels.channelById(item.channelId),
                );
                const dm = createMemo(() => store.dms.dmById(item.channelId));
                return (
                  <div class="later-item">
                    <SplitNavigation
                      onSplit={() => {
                        const rootTs = msg()?.threadTs;
                        openConversationInSplit(item.channelId, rootTs ?? item.ts);
                      }}
                    >
                      <button
                        class="later-main btn-reset"
                        data-nav-row
                        onClick={() => {
                          const rootTs = msg()?.threadTs;
                          goTo(item.channelId, rootTs ?? item.ts, rootTs ? item.ts : undefined);
                        }}
                        type="button"
                      >
                        <div class="later-channel">
                          {conversationDisplayName(
                            item.channelId,
                            channel(),
                            dm(),
                            store.users.userById,
                          )}
                        </div>
                        <div class="later-snippet">
                          <Show
                            fallback={loadError() ? "Couldn’t load this message." : "Loading…"}
                            when={isLoaded()}
                          >
                            <Show fallback="Message unavailable" when={msg()}>
                              {(message) => <Mrkdwn text={message().text} />}
                            </Show>
                          </Show>
                        </div>
                      </button>
                    </SplitNavigation>
                    <Show when={loadError()}>
                      <button
                        class="later-message-retry btn-reset text-accent"
                        disabled={isLoading()}
                        onClick={() => store.later.ensureLaterMessageLoaded(item)}
                        type="button"
                      >
                        Retry
                      </button>
                    </Show>
                    <IconButton
                      class="later-remove"
                      disabled={
                        store.later.laterLoading() ||
                        store.later.isSaveForLaterPending(item.channelId, item.ts)
                      }
                      icon="bookmark-filled"
                      label="Remove from Later"
                      onClick={() => store.later.toggleSaveForLater(item.channelId, item.ts)}
                      tone="accent"
                    />
                    <InlineFeedback
                      class="later-feedback"
                      feedback={actionFeedback.get(item.ts)}
                      priority={2}
                    />
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
