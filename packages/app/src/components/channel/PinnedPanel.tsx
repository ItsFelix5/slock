import { Mrkdwn } from "@slock/blockkit";
import { InlineFeedback, Overlay, PanelHeader, useEscapeClose } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { actionFeedback, channelDisplayName, dmDisplayName, store } from "../../lib/store";
import "./PinnedPanel.css";

export default function PinnedPanel() {
  const channelId = store.pinned.pinnedPanelChannelId;
  useEscapeClose(store.pinned.closePinnedPanel);

  const pins = createMemo(() => {
    const id = channelId();
    return id ? (store.pinned.pinnedMessagesCache[id] ?? []) : [];
  });

  // Generic conversation id — could be a channel or a DM, so every lookup here
  // has to branch on which one it actually resolves to.
  const title = () => {
    const id = channelId();
    if (!id) return "";
    const channel = store.channels.channelById(id);
    if (channel) return `Pinned in #${channelDisplayName(channel)}`;
    const dmName = dmDisplayName(store.dms.dmById(id), store.users.userById);
    return `Pinned in ${dmName || "conversation"}`;
  };

  const goTo = (ts: string) => {
    const id = channelId();
    if (!id) return;
    store.viewState.setActiveView({ id, kind: store.channels.channelById(id) ? "channel" : "dm" });
    store.viewState.openThread(id, ts);
    store.pinned.closePinnedPanel();
  };

  const unpin = async (id: string, ts: string) => {
    await store.pinned.togglePinMessage(id, ts);
    store.pinned.openPinnedPanel(id); // refresh the list so the unpinned item drops off immediately
  };

  return (
    <Show when={channelId()}>
      {(id) => (
        <Overlay align="top" onClose={store.pinned.closePinnedPanel}>
          <div class="pinned-panel-card surface-card">
            <PanelHeader onClose={store.pinned.closePinnedPanel}>
              <div class="pinned-panel-title">{title()}</div>
            </PanelHeader>
            <div class="pinned-panel-list">
              <For
                each={pins()}
                fallback={<div class="pinned-panel-empty empty-state">No pinned messages yet.</div>}
              >
                {(pin) => (
                  <Show when={pin.message}>
                    {(msg) => (
                      <div class="pinned-panel-item">
                        <button
                          class="pinned-panel-item-main btn-reset"
                          onClick={() => goTo(pin.ts)}
                          type="button"
                        >
                          <Mrkdwn text={msg().text} />
                        </button>
                        <button
                          class="pinned-panel-unpin"
                          onClick={() => id() && unpin(id(), pin.ts)}
                          title="Unpin"
                          type="button"
                        >
                          Unpin
                        </button>
                        <InlineFeedback
                          class="pinned-panel-feedback"
                          feedback={actionFeedback.get(pin.ts)}
                        />
                      </div>
                    )}
                  </Show>
                )}
              </For>
            </div>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
