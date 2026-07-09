import { Mrkdwn } from "@slock/blockkit";
import { Icon } from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import {
  channelById,
  channelDisplayName,
  ensureLaterLoaded,
  ensureLaterMessageLoaded,
  laterItems,
  laterMessages,
  openChannelPeek,
  toggleSaveForLater,
} from "../../lib/store";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => ensureLaterLoaded());

  const goTo = (channelId: string, ts: string) => openChannelPeek(channelId, ts);

  return (
    <div class="later-view">
      <h2>Later</h2>
      <Show
        when={laterItems.length > 0}
        fallback={<div class="later-empty">Nothing saved for later.</div>}
      >
        <For each={laterItems}>
          {(item) => {
            const key = `${item.channelId}:${item.ts}`;
            onMount(() => ensureLaterMessageLoaded(item));
            const isLoaded = createMemo(() => key in laterMessages);
            const msg = createMemo(() => laterMessages[key]);
            const channel = createMemo(() => channelById(item.channelId));
            return (
              <div class="later-item">
                <button
                  type="button"
                  class="later-main"
                  onClick={() => goTo(item.channelId, item.ts)}
                >
                  <div class="later-channel">
                    #{channelDisplayName(channel(), item.channelId)}
                  </div>
                  <div class="later-snippet">
                    <Show
                      when={!isLoaded()}
                      fallback={
                        <Show when={msg()} fallback="Message unavailable">
                          {(m) => <Mrkdwn text={m().text} />}
                        </Show>
                      }
                    >
                      Loading…
                    </Show>
                  </div>
                </button>
                <button
                  type="button"
                  class="later-remove"
                  title="Remove from Later"
                  onClick={() => toggleSaveForLater(item.channelId, item.ts)}
                >
                  <Icon name="bookmark-filled" size={16} />
                </button>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
