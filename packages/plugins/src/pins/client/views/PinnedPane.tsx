import { service } from "@slock/core/solid";
import { ifPresent, parseTs } from "@slock/slack";
import type { Ts } from "@slock/types";
import { Button, type Pane, PanelHeader } from "@slock/ui";
import { createEffect, createMemo, Show } from "solid-js";
import { createMessageFocus } from "../../../messages/client/api/messageFocus";
import MessageRows from "../../../messages/client/api/pane/MessageRows";
import { createFeedScroll } from "../../../messages/client/api/pane/scroll/feedScroll";
import type { PinnedPaneContent } from "../api";
import "./PinnedPane.css";

const viewStore = service("shell.view");
const messageLinks = service("message-links");
const titles = service("titles");

const pinned = service("pins");

const INTERACTIVE = "a, button, input, textarea, select, [contenteditable], [role='button']";

export default function PinnedPane(props: { pane: Pane<PinnedPaneContent> }) {
  const channelId = () => props.pane.content.channelId;
  const feed = createFeedScroll({ isLive: () => false });

  const pins = () => pinned.pinnedMessagesFor(channelId());
  const messages = createMemo(() =>
    (pins() ?? []).flatMap((pin) => (pin.message ? [pin.message] : [])),
  );
  const loading = () => pinned.isPinnedMessagesLoading(channelId());
  const loadError = () => pinned.hasPinnedMessagesError(channelId());

  createEffect(channelId, (id) => void pinned.refreshPinnedMessages(id));

  const openThread = (ts: Ts) => messageLinks.openThread(channelId(), ts);
  const goTo = (ts: Ts) => {
    const message = messages().find((m) => m.ts === ts);
    if (message) messageLinks.openChannelMessage(channelId(), ts, message.threadTs);
  };

  const messageFocus = createMessageFocus(messages, feed, channelId, {
    onOpenThread: openThread,
  });

  const tsOf = (target: EventTarget | null) =>
    ifPresent(
      parseTs,
      target instanceof Element
        ? target.closest<HTMLElement>("[data-message-ts]")?.dataset.messageTs
        : undefined,
    );

  return (
    <div class="pinned-panel-card surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
        title={`Pinned in ${titles.label(channelId())}`}
      />
      <div
        aria-busy={loading() ? "true" : "false"}
        class="pinned-panel-list"
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
          const ts = tsOf(e.target);
          if (ts) goTo(ts);
        }}
        onFocusIn={messageFocus.onContainerFocusIn}
        onFocusOut={messageFocus.onContainerFocusOut}
        onKeyDown={(e) => {
          const ts = ifPresent(
            parseTs,
            e.target instanceof HTMLElement ? e.target.dataset.messageTs : undefined,
          );
          if (e.key === "Enter" && ts) goTo(ts);
        }}
        ref={feed.attach}
      >
        <Show when={loading() && pins() !== undefined && !loadError()}>
          <div class="pinned-panel-refreshing text-dim text-sm">Refreshing…</div>
        </Show>
        <Show when={loading() && pins() === undefined}>
          <div class="pinned-panel-empty empty-state">Loading pinned messages…</div>
        </Show>
        <Show when={loadError()}>
          <div class="pinned-panel-load-error flex-center empty-state">
            <span>Couldn't load pinned messages.</span>
            <Button onClick={() => pinned.refreshPinnedMessages(channelId())} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={pins()}>
          {(items) => (
            <Show
              fallback={<div class="pinned-panel-empty empty-state">No pinned messages yet.</div>}
              when={items().length > 0}
            >
              <MessageRows
                channelId={channelId()}
                editingTs={messageFocus.editingTs}
                focusedTs={messageFocus.focusedTs}
                messages={messages()}
                moreMenuTs={messageFocus.moreMenuTs}
                onOpenThread={openThread}
                onStartEdit={messageFocus.onStartEdit}
                onStopEdit={messageFocus.onStopEdit}
                onToggleMoreMenu={messageFocus.onToggleMoreMenu}
                onToggleReactionPicker={messageFocus.onToggleReactionPicker}
                reactionPickerTs={messageFocus.reactionPickerTs}
              />
            </Show>
          )}
        </Show>
      </div>
    </div>
  );
}
