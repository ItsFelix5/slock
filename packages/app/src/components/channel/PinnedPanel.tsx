import { Mrkdwn } from "@slock/blockkit";
import { Button, InlineFeedback, Overlay, PanelHeader, Tooltip, useEscapeClose } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { actionFeedback, conversationDisplayName, store } from "../../lib/store";
import "./PinnedPanel.css";

export default function PinnedPanel() {
  const channelId = store.pinned.pinnedPanelChannelId;
  useEscapeClose(store.pinned.closePinnedPanel, () => !!channelId());

  const pins = createMemo(() => {
    const id = channelId();
    return id ? store.pinned.pinnedMessagesCache[id] : undefined;
  });
  const loading = () => !!store.pinned.pinnedMessagesLoading[channelId() ?? ""];
  const loadError = () => !!store.pinned.pinnedMessagesError[channelId() ?? ""];

  const title = () => {
    const id = channelId();
    if (!id) return "";
    const channel = id.startsWith("D") ? undefined : store.channels.channelById(id);
    return `Pinned in ${conversationDisplayName(id, channel, store.dms.dmById(id), store.users.userById)}`;
  };

  const goTo = (ts: string) => {
    const id = channelId();
    if (!id) return;
    store.viewState.setActiveView({ id, kind: store.channels.channelById(id) ? "channel" : "dm" });
    store.viewState.openThread(id, ts);
    store.pinned.closePinnedPanel();
  };

  const unpin = async (id: string, ts: string) => {
    if (await store.pinned.togglePinMessage(id, ts)) {
      store.pinned.openPinnedPanel(id); // refresh the list so the unpinned item drops off immediately
    }
  };

  return (
    <Show when={channelId()}>
      {(id) => (
        <Overlay ariaLabel={title()} align="top" onClose={store.pinned.closePinnedPanel}>
          <div class="pinned-panel-card surface-card" data-pane="detail">
            <PanelHeader onClose={store.pinned.closePinnedPanel}>
              <div class="pinned-panel-title">{title()}</div>
            </PanelHeader>
            <div aria-busy={loading()} class="pinned-panel-list">
              <Show when={loading() && pins() !== undefined && !loadError()}>
                <div class="pinned-panel-refreshing text-dim text-sm">Refreshing…</div>
              </Show>
              <Show when={loading() && pins() === undefined}>
                <div class="pinned-panel-empty empty-state">Loading pinned messages…</div>
              </Show>
              <Show when={loadError()}>
                <div class="pinned-panel-load-error empty-state" role="alert">
                  <span>Couldn’t load pinned messages.</span>
                  <Button onClick={() => store.pinned.refreshPinnedMessages(id())} size="sm">
                    Try again
                  </Button>
                </div>
              </Show>
              <Show when={pins()}>
                {(items) => (
                  <For
                    each={items()}
                    fallback={
                      <div class="pinned-panel-empty empty-state">No pinned messages yet.</div>
                    }
                  >
                    {(pin) => (
                      <Show when={pin.message}>
                        {(msg) => (
                          <div class="pinned-panel-item">
                            <button
                              class="pinned-panel-item-main btn-reset"
                              data-nav-row
                              onClick={() => goTo(pin.ts)}
                              type="button"
                            >
                              <Mrkdwn text={msg().text} />
                            </button>
                            <Tooltip content="Unpin">
                              <button
                                aria-label="Unpin"
                                class="pinned-panel-unpin"
                                disabled={store.pinned.isPinPending(id(), pin.ts)}
                                onClick={() => id() && unpin(id(), pin.ts)}
                                type="button"
                              >
                                Unpin
                              </button>
                            </Tooltip>
                            <InlineFeedback
                              class="pinned-panel-feedback"
                              feedback={actionFeedback.get(pin.ts)}
                              priority={2}
                            />
                          </div>
                        )}
                      </Show>
                    )}
                  </For>
                )}
              </Show>
            </div>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
