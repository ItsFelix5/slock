import { For, Show, createMemo } from 'solid-js';
import {
  pinnedPanelChannelId,
  pinnedMessagesCache,
  closePinnedPanel,
  channelById,
  togglePinMessage,
  openPinnedPanel,
  openThread,
  setActiveView,
} from '../store';
import Mrkdwn from '../blockkit/mrkdwn';
import { useEscapeClose } from '../useEscapeClose';
import './PinnedPanel.css';

export default function PinnedPanel() {
  const channelId = pinnedPanelChannelId;
  useEscapeClose(closePinnedPanel);

  const pins = createMemo(() => {
    const id = channelId();
    return id ? (pinnedMessagesCache[id] ?? []) : [];
  });

  const goTo = (ts: string) => {
    const id = channelId();
    if (!id) return;
    setActiveView({ kind: 'channel', id });
    openThread(id, ts);
    closePinnedPanel();
  };

  const unpin = async (id: string, ts: string) => {
    await togglePinMessage(id, ts);
    openPinnedPanel(id); // refresh the list so the unpinned item drops off immediately
  };

  return (
    <Show when={channelId()}>
      {(id) => (
        <div class="pinned-panel-overlay" onClick={(e) => e.target === e.currentTarget && closePinnedPanel()}>
          <div class="pinned-panel-card">
            <div class="pinned-panel-header">
              <div class="pinned-panel-title">Pinned in #{channelById(id())?.name ?? ''}</div>
              <button class="pinned-panel-close" onClick={closePinnedPanel} title="Close">
                ✕
              </button>
            </div>
            <div class="pinned-panel-list">
              <For each={pins()} fallback={<div class="pinned-panel-empty">No pinned messages yet.</div>}>
                {(pin) => (
                  <Show when={pin.message}>
                    {(msg) => (
                      <div class="pinned-panel-item">
                        <button class="pinned-panel-item-main" onClick={() => goTo(pin.ts)}>
                          <Mrkdwn text={msg().text} />
                        </button>
                        <button
                          class="pinned-panel-unpin"
                          title="Unpin"
                          onClick={() => id() && unpin(id(), pin.ts)}
                        >
                          Unpin
                        </button>
                      </div>
                    )}
                  </Show>
                )}
              </For>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
