import { service } from "@slock/core/solid";
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
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import MessageActionsMenuItems from "../../../messages/client/api/cards/MessageActionsMenuItems";
import MessageReferenceSnippet from "../../../messages/client/api/cards/MessageReferenceSnippet";
import ResultMessageCard from "../../../messages/client/api/cards/ResultMessageCard";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../../../messages/client/api/messageAuthor";
import type { PinnedPaneContent } from "../api";
import "./PinnedPane.css";

const feedback = service("feedback");

const viewStore = service("shell.view");
const messageLinks = service("message-links");
const titles = service("titles");
const usersStore = service("users");

const pinned = service("pins");

export default function PinnedPane(props: { pane: Pane<PinnedPaneContent> }) {
  let listRef: HTMLDivElement | undefined;
  const channelId = () => props.pane.content.channelId;

  const pins = () => pinned.pinnedMessagesFor(channelId());
  initRovingTabIndexDefault(() => listRef, pins);
  const loading = () => pinned.isPinnedMessagesLoading(channelId());
  const loadError = () => pinned.hasPinnedMessagesError(channelId());

  createEffect(on(channelId, (id) => pinned.refreshPinnedMessages(id)));

  const title = () => `Pinned in ${titles.label(channelId())}`;

  const goTo = (ts: string, threadTs: string | undefined) => {
    const id = channelId();
    messageLinks.openChannelMessage(id, ts, threadTs);
    viewStore.closeTile(props.pane.id);
  };

  const unpin = async (id: string, ts: string) => {
    if (await pinned.togglePinMessage(id, ts)) {
      pinned.refreshPinnedMessages(id);
    }
  };

  return (
    <div class="pinned-panel-card surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
      >
        <div class="pinned-panel-title title-sm">{title()}</div>
      </PanelHeader>
      <div class="pinned-panel-list" ref={listRef}>
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
                      return id ? usersStore.userById(id) : undefined;
                    };
                    const displayName = () =>
                      resolveAuthorDisplayName(msg(), user()?.name, "Unknown");
                    const avatarUrl = () => resolveAuthorAvatarUrl(msg(), user()?.avatarUrl);
                    const pending = () => pinned.isPinPending(channelId(), pin.ts);
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
                          class="pinned-panel-feedback truncate"
                          feedback={feedback.get(pin.ts)}
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
