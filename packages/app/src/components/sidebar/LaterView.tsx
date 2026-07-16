import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback, Tooltip } from "@slock/ui";
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
        fallback={<div class="later-empty empty-state">Nothing saved for later.</div>}
        when={store.later.laterItems.length > 0}
      >
        <For each={store.later.laterItems}>
          {(item) => {
            const key = `${item.channelId}:${item.ts}`;
            onMount(() => store.later.ensureLaterMessageLoaded(item));
            const isLoaded = createMemo(() => key in store.later.laterMessages);
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
                  <div class="later-channel">#{channelDisplayName(channel(), item.channelId)}</div>
                  <div class="later-snippet">
                    <Show
                      fallback={
                        <Show fallback="Message unavailable" when={msg()}>
                          {(m) => <Mrkdwn text={m().text} />}
                        </Show>
                      }
                      when={!isLoaded()}
                    >
                      Loading…
                    </Show>
                  </div>
                </button>
                <Tooltip content="Remove from Later">
                  <button
                    aria-label="Remove from Later"
                    class="later-remove btn-reset icon-btn icon-action text-accent"
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
    </div>
  );
}
