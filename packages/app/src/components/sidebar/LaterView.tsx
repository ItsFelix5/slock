import { Mrkdwn } from "@slock/blockkit";
import { Button, Icon, InlineFeedback, Tooltip } from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => store.later.ensureLaterLoaded());

  const goTo = (channelId: string, ts: string, highlightTs?: string) =>
    store.viewState.openChannelPeek(channelId, ts, highlightTs);

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
                const channel = createMemo(() => store.channels.channelById(item.channelId));
                return (
                  <div class="later-item">
                    <button
                      class="later-main btn-reset"
                      onClick={() => {
                        const rootTs = msg()?.threadTs;
                        goTo(item.channelId, rootTs ?? item.ts, rootTs ? item.ts : undefined);
                      }}
                      type="button"
                    >
                      <div class="later-channel">
                        #{channelDisplayName(channel(), item.channelId)}
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
                    <Tooltip content="Remove from Later">
                      <button
                        aria-label="Remove from Later"
                        class="later-remove btn-reset icon-btn icon-action text-accent"
                        disabled={
                          store.later.laterLoading() ||
                          store.later.isSaveForLaterPending(item.channelId, item.ts)
                        }
                        onClick={() => store.later.toggleSaveForLater(item.channelId, item.ts)}
                        type="button"
                      >
                        <Icon name="bookmark-filled" size={16} />
                      </button>
                    </Tooltip>
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
