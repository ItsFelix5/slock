import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback } from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import { store, actionFeedback, channelDisplayName } from "../../lib/store";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => store.later.ensureLaterLoaded());

  const goTo = (channelId: string, ts: string) => store.viewState.openChannelPeek(channelId, ts);

  return (
    <div class="later-view">
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
                  onClick={() => goTo(item.channelId, item.ts)}
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
                <button
                  class="later-remove btn-reset icon-btn icon-action text-accent"
                  onClick={() => store.later.toggleSaveForLater(item.channelId, item.ts)}
                  title="Remove from Later"
                  type="button"
                >
                  <Icon name="bookmark-filled" size={16} />
                </button>
                <InlineFeedback class="later-feedback" feedback={actionFeedback.get(item.ts)} />
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
