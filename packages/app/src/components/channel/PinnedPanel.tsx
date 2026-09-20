import {
  Button,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  IconButton,
  InlineFeedback,
  initRovingTabIndexDefault,
  type Pane,
  PanelHeader,
  useContextMenu,
} from "@slock/ui";
import { createEffect, For, on, Show } from "solid-js";
import { conversationDisplayName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { openConversationInSplit } from "../../lib/navigation/conversationNav";
import { store } from "../../lib/store";
import type { PinnedPaneContent } from "../../lib/store/slices/types";
import MessageActionsMenuItems from "../messages/parts/MessageActionsMenuItems";
import MessageReferenceSnippet from "../messages/parts/MessageReferenceSnippet";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../messages/parts/messageRenderState";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import "./PinnedPanel.css";

export default function PinnedPanel(props: { pane: Pane<PinnedPaneContent> }) {
  let listRef: HTMLDivElement | undefined;
  const channelId = () => props.pane.content.channelId;

  const pins = () => store.pinned.pinnedMessagesFor(channelId());
  initRovingTabIndexDefault(() => listRef, pins);
  const loading = () => store.pinned.isPinnedMessagesLoading(channelId());
  const loadError = () => store.pinned.hasPinnedMessagesError(channelId());

  createEffect(on(channelId, (id) => store.pinned.refreshPinnedMessages(id)));

  const title = () =>
    `Pinned in ${conversationDisplayName(channelId(), store.channels.channelById, store.dms.dmById, store.users.userById)}`;

  const goTo = (ts: string, threadTs: string | undefined) => {
    const id = channelId();
    if (threadTs && threadTs !== ts)
      store.viewState.openChannelPeek(id, threadTs, ts, { keepNav: true });
    else store.viewState.openChannelMessage(id, ts, { keepNav: true });
    store.viewState.closeTile(props.pane.id);
  };

  const unpin = async (id: string, ts: string) => {
    if (await store.pinned.togglePinMessage(id, ts)) {
      store.pinned.refreshPinnedMessages(id);
    }
  };

  return (
    <div class="pinned-panel-card surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={store.viewState.canCloseTile()}
        onClose={() => store.viewState.closeTile(props.pane.id)}
      >
        <div class="pinned-panel-title">{title()}</div>
      </PanelHeader>
      <div class="pinned-panel-list" ref={listRef}>
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
                  {(msg) => {
                    const profileUserId = () => resolveProfileUserId(msg());
                    const user = () => {
                      const id = profileUserId();
                      return id ? store.users.userById(id) : undefined;
                    };
                    const displayName = () =>
                      resolveAuthorDisplayName(msg(), user()?.name, "Unknown");
                    const avatarUrl = () => resolveAuthorAvatarUrl(msg(), user()?.avatarUrl);
                    const pending = () => store.pinned.isPinPending(channelId(), pin.ts);
                    const ctxMenu = useContextMenu();
                    const openMessage = () => goTo(pin.ts, msg().threadTs);
                    return (
                      <div class="pinned-panel-item">
                        <ResultMessageCard
                          avatarUser={{
                            avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                            avatarUrl: avatarUrl(),
                            id: profileUserId() ?? msg().userId,
                            name: displayName(),
                          }}
                          ctxMenu={ctxMenu}
                          name={displayName()}
                          navRow
                          onOpen={openMessage}
                          onSplit={() =>
                            openConversationInSplit(channelId(), msg().threadTs ?? pin.ts)
                          }
                          snippet={
                            <MessageReferenceSnippet
                              blocks={msg().blocks}
                              botId={msg().botId}
                              botUserId={msg().userId}
                              channelId={channelId()}
                              edited={msg().edited}
                              text={msg().text}
                              threadTs={msg().threadTs}
                              ts={msg().ts}
                              tz={user()?.tz}
                            />
                          }
                          tabIndex={-1}
                          time={msg().time}
                          timeTitle={`${msg().day} at ${msg().time}`}
                          trailing={
                            <IconButton
                              disabled={pending()}
                              icon="pin-filled"
                              label="Unpin from channel"
                              onClick={() => unpin(channelId(), pin.ts)}
                              tone="accent"
                            />
                          }
                          userId={profileUserId()}
                        />
                        <InlineFeedback
                          class="pinned-panel-feedback"
                          feedback={actionFeedback.get(pin.ts)}
                          priority={2}
                        />
                        <ContextMenu
                          onClose={ctxMenu.close}
                          open={ctxMenu.isOpen()}
                          x={ctxMenu.x()}
                          y={ctxMenu.y()}
                        >
                          <MessageActionsMenuItems
                            channelId={channelId()}
                            msg={msg()}
                            onClose={ctxMenu.close}
                            onEditRequest={openMessage}
                            threadTs={msg().threadTs}
                          />
                        </ContextMenu>
                      </div>
                    );
                  }}
                </Show>
              )}
            </For>
          )}
        </Show>
      </div>
    </div>
  );
}
