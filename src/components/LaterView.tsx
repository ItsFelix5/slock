import { For, Show, createMemo, onMount } from 'solid-js';
import {
  laterItems,
  laterMessages,
  ensureLaterLoaded,
  ensureLaterMessageLoaded,
  channelById,
  setActiveView,
  openThread,
  toggleSaveForLater,
} from '../store';
import Mrkdwn from '../blockkit/mrkdwn';
import Icon from '../icons';
import './LaterView.css';

export default function LaterView() {
  onMount(() => ensureLaterLoaded());

  const goTo = (channelId: string, ts: string) => {
    setActiveView({ kind: 'channel', id: channelId });
    openThread(channelId, ts);
  };

  return (
    <div class="later-view">
      <h2>Later</h2>
      <Show when={laterItems.length > 0} fallback={<div class="later-empty">Nothing saved for later.</div>}>
        <For each={laterItems}>
          {(item) => {
            const key = `${item.channelId}:${item.ts}`;
            onMount(() => ensureLaterMessageLoaded(item));
            const isLoaded = createMemo(() => key in laterMessages);
            const msg = createMemo(() => laterMessages[key]);
            const channel = createMemo(() => channelById(item.channelId));
            return (
              <div class="later-item">
                <button class="later-main" onClick={() => goTo(item.channelId, item.ts)}>
                  <div class="later-channel">#{channel()?.name ?? item.channelId}</div>
                  <div class="later-snippet">
                    <Show when={!isLoaded()} fallback={<Show when={msg()} fallback="Message unavailable">{(m) => <Mrkdwn text={m().text} />}</Show>}>
                      Loading…
                    </Show>
                  </div>
                </button>
                <button class="later-remove" title="Remove from Later" onClick={() => toggleSaveForLater(item.channelId, item.ts)}>
                  <Icon name="bookmark" size={16} />
                </button>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
