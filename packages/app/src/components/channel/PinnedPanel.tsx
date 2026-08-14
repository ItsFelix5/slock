import { Mrkdwn } from "@slock/blockkit";
import { Button, InlineFeedback, type Pane, PanelHeader, Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import { closeTile } from "../../lib/paneActions";
import { actionFeedback, conversationDisplayName, store } from "../../lib/store";
import type { PinnedPaneContent } from "../../lib/store/slices/types";
import "./PinnedPanel.css";

export default function PinnedPanel(props: { pane: Pane<PinnedPaneContent> }) {
  const channelId = () => props.pane.content.channelId;

  const pins = () => store.pinned.pinnedMessagesCache[channelId()];
  const loading = () => !!store.pinned.pinnedMessagesLoading[channelId()];
  const loadError = () => !!store.pinned.pinnedMessagesError[channelId()];

  const title = () => {
    const id = channelId();
    const channel = id.startsWith("D") ? undefined : store.channels.channelById(id);
    return `Pinned in ${conversationDisplayName(id, channel, store.dms.dmById(id), store.users.userById)}`;
  };

  const goTo = (ts: string) => {
    const id = channelId();
    store.viewState.setActiveView({ id, kind: store.channels.channelById(id) ? "channel" : "dm" });
    store.viewState.openThread(id, ts);
    closeTile(props.pane.id);
  };

  const unpin = async (id: string, ts: string) => {
    if (await store.pinned.togglePinMessage(id, ts)) {
      store.pinned.refreshPinnedMessages(id);
    }
  };

  return (
    <div class="pinned-panel-card surface-card" data-pane={props.pane.id}>
      <PanelHeader onClose={() => closeTile(props.pane.id)}>
        <div class="pinned-panel-title">{title()}</div>
      </PanelHeader>
      <div class="pinned-panel-list">
        <Show when={loading() && pins() !== undefined && !loadError()}>
          <div class="pinned-panel-refreshing text-dim text-sm">Refreshing…</div>
        </Show>
        <Show when={loading() && pins() === undefined}>
          <div class="pinned-panel-empty empty-state">Loading pinned messages…</div>
        </Show>
        <Show when={loadError()}>
          <div class="pinned-panel-load-error empty-state">
            <span>Couldn't load pinned messages.</span>
            <Button onClick={() => store.pinned.refreshPinnedMessages(channelId())} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={pins()}>
          {(items) => (
            <For
              each={items()}
              fallback={<div class="pinned-panel-empty empty-state">No pinned messages yet.</div>}
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
                          class="pinned-panel-unpin"
                          disabled={store.pinned.isPinPending(channelId(), pin.ts)}
                          onClick={() => unpin(channelId(), pin.ts)}
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
  );
}
