import { Mrkdwn } from "@slock/blockkit";
import {
  Button,
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  IconButton,
  InlineFeedback,
  useContextMenu,
} from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import {
  openConversation,
  openConversationInSplit,
} from "../../components/navigation/SplitNavigation";
import { formatTime } from "../../lib/api";
import { conversationDisplayName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import MessageActionsMenuItems from "../messages/parts/MessageActionsMenuItems";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../messages/parts/messageRenderState";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => store.later.ensureLaterLoaded());

  const goTo = (channelId: string, ts: string, rootTs?: string) => {
    if (rootTs) store.viewState.openChannelPeek(channelId, rootTs, ts, { keepNav: true });
    else store.viewState.openChannelMessage(channelId, ts, { keepNav: true });
  };

  return (
    <div class="later-view sidebar-view-panel">
      <Show
        fallback={<div class="later-empty empty-state">Loading saved items…</div>}
        when={store.later.laterLoaded() || store.later.laterLoadError()}
      >
        <Show
          fallback={
            <div class="later-load-error empty-state flex-col">
              <span>Couldn't load saved items.</span>
              <Button onClick={store.later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          }
          when={store.later.laterLoaded() || !store.later.laterLoadError()}
        >
          <Show when={store.later.laterLoading() && store.later.laterLoaded()}>
            <div class="later-load-notice text-dim text-sm">Refreshing saved items…</div>
          </Show>
          <Show when={store.later.laterLoadError() && store.later.laterLoaded()}>
            <div class="later-load-notice later-load-warning">
              <span>Couldn't refresh saved items.</span>
              <Button onClick={store.later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          </Show>
          <Show
            fallback={<div class="later-empty empty-state">Nothing saved for later.</div>}
            when={store.later.laterItems.length > 0}
          >
            <For each={store.later.laterItems}>
              {(item) => {
                const key = `${item.channelId}:${item.ts}`;
                onMount(() => store.later.ensureLaterMessageLoaded(item));
                const isLoaded = createMemo(() => key in store.later.laterMessages);
                const isLoading = createMemo(() =>
                  store.later.isLaterMessageLoading(item.channelId, item.ts),
                );
                const loadError = createMemo(() =>
                  store.later.hasLaterMessageError(item.channelId, item.ts),
                );
                const msg = createMemo(() => store.later.laterMessages[key]);

                const authorId = createMemo(() => resolveProfileUserId(msg() ?? { userId: "" }));
                const author = createMemo(() => {
                  const id = authorId();
                  return id ? store.users.userById(id) : undefined;
                });
                const authorName = createMemo(() => {
                  const message = msg();
                  return message
                    ? resolveAuthorDisplayName(message, author()?.name, "Unknown")
                    : "Loading…";
                });
                const avatarUrl = createMemo(() => {
                  const message = msg();
                  return message ? resolveAuthorAvatarUrl(message, author()?.avatarUrl) : undefined;
                });
                const timeTitle = createMemo(() => {
                  const message = msg();
                  return message ? `${message.day} at ${message.time}` : undefined;
                });
                const ctxMenu = useContextMenu();
                return (
                  <div class="later-item">
                    <ResultMessageCard
                      avatarUser={{
                        avatarColor: author()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                        avatarUrl: avatarUrl(),
                        id: authorId() ?? "",
                        name: authorName(),
                      }}
                      context={
                        <ClickableInline onActivate={() => openConversation(item.channelId)}>
                          {conversationDisplayName(
                            item.channelId,
                            store.channels.channelById,
                            store.dms.dmById,
                            store.users.userById,
                          )}
                        </ClickableInline>
                      }
                      ctxMenu={isLoaded() ? ctxMenu : undefined}
                      name={authorName()}
                      navRow
                      onOpen={() => {
                        const threadTs = msg()?.threadTs;
                        goTo(
                          item.channelId,
                          item.ts,
                          threadTs && threadTs !== item.ts ? threadTs : undefined,
                        );
                      }}
                      onSplit={() => {
                        const rootTs = msg()?.threadTs;
                        openConversationInSplit(item.channelId, rootTs ?? item.ts);
                      }}
                      snippet={
                        <Show
                          fallback={loadError() ? "Couldn't load this message." : "Loading…"}
                          when={isLoaded()}
                        >
                          <Show fallback="Message unavailable" when={msg()}>
                            {(message) => <Mrkdwn text={message().text} />}
                          </Show>
                        </Show>
                      }
                      time={formatTime(item.ts)}
                      timeTitle={timeTitle()}
                      userId={authorId()}
                      trailing={
                        <>
                          <Show when={loadError()}>
                            <button
                              class="later-message-retry btn-reset text-accent"
                              disabled={isLoading()}
                              onClick={() => store.later.ensureLaterMessageLoaded(item)}
                              type="button"
                            >
                              Retry
                            </button>
                          </Show>
                          <IconButton
                            class="later-remove"
                            disabled={
                              store.later.laterLoading() ||
                              store.later.isSaveForLaterPending(item.channelId, item.ts)
                            }
                            icon="bookmark-filled"
                            label="Remove from Later"
                            onClick={() => store.later.toggleSaveForLater(item.channelId, item.ts)}
                            tone="accent"
                          />
                        </>
                      }
                    />
                    <InlineFeedback
                      class="later-feedback"
                      feedback={actionFeedback.get(item.ts)}
                      priority={2}
                    />
                    <Show when={msg()}>
                      {(message) => (
                        <ContextMenu
                          onClose={ctxMenu.close}
                          open={ctxMenu.isOpen()}
                          x={ctxMenu.x()}
                          y={ctxMenu.y()}
                        >
                          <MessageActionsMenuItems
                            channelId={item.channelId}
                            msg={message()}
                            onClose={ctxMenu.close}
                            onEditRequest={() => {
                              const { threadTs } = message();
                              goTo(
                                item.channelId,
                                item.ts,
                                threadTs && threadTs !== item.ts ? threadTs : undefined,
                              );
                            }}
                            threadTs={message().threadTs}
                          />
                        </ContextMenu>
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
