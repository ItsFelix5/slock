import { formatTime } from "@slock/core";
import { service } from "@slock/core/solid";
import {
  Button,
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  IconButton,
  InlineFeedback,
  initRovingTabIndexDefault,
  useContextMenu,
} from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import { openConversation, openConversationInSplit } from "../../../conversations/client/api/nav";
import MessageActionsMenuItems from "../../../messages/client/api/cards/MessageActionsMenuItems";
import MessageReferenceSnippet from "../../../messages/client/api/cards/MessageReferenceSnippet";
import ResultMessageCard from "../../../messages/client/api/cards/ResultMessageCard";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../../../messages/client/api/messageAuthor";
import { SplitNavigation } from "../../../shell/client/api/SplitNavigation";
import "./LaterView.css";

const feedback = service("feedback");

const messageLinks = service("message-links");
const titles = service("titles");
const usersStore = service("users");

const later = service("later");

export default function LaterView() {
  onMount(() => later.ensureLaterLoaded());
  let listRef: HTMLDivElement | undefined;
  initRovingTabIndexDefault(
    () => listRef,
    () => later.laterItems,
  );

  const goTo = (channelId: string, ts: string, rootTs?: string) => {
    messageLinks.openChannelMessage(channelId, ts, rootTs);
  };

  return (
    <div class="later-view sidebar-view-panel" ref={listRef}>
      <Show
        fallback={<div class="later-empty empty-state">Loading saved items…</div>}
        when={later.laterLoaded() || later.laterLoadError()}
      >
        <Show
          fallback={
            <div class="later-load-error empty-state flex-col">
              <span>Couldn't load saved items.</span>
              <Button onClick={later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          }
          when={later.laterLoaded() || !later.laterLoadError()}
        >
          <Show when={later.laterLoading() && later.laterLoaded()}>
            <div class="later-load-notice flex-center gap-sm text-dim text-sm">
              Refreshing saved items…
            </div>
          </Show>
          <Show when={later.laterLoadError() && later.laterLoaded()}>
            <div class="later-load-notice flex-center gap-sm later-load-warning">
              <span>Couldn't refresh saved items.</span>
              <Button onClick={later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          </Show>
          <Show
            fallback={<div class="later-empty empty-state">Nothing saved for later.</div>}
            when={later.laterItems.length > 0}
          >
            <For each={later.laterItems}>
              {(item) => {
                onMount(() => later.ensureLaterMessageLoaded(item));
                const msg = createMemo(() => later.laterMessageFor(item.channelId, item.ts));
                const isLoaded = createMemo(() => msg() !== undefined);
                const isLoading = createMemo(() =>
                  later.isLaterMessageLoading(item.channelId, item.ts),
                );
                const loadError = createMemo(() =>
                  later.hasLaterMessageError(item.channelId, item.ts),
                );

                const authorId = createMemo(() => resolveProfileUserId(msg() ?? { userId: "" }));
                const author = createMemo(() => {
                  const id = authorId();
                  return id ? usersStore.userById(id) : undefined;
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
                        <SplitNavigation onSplit={() => openConversationInSplit(item.channelId)}>
                          <ClickableInline onActivate={() => openConversation(item.channelId)}>
                            <span class="result-message-card-context-text">
                              {titles.label(item.channelId)}
                            </span>
                          </ClickableInline>
                        </SplitNavigation>
                      }
                      ctxMenu={isLoaded() ? ctxMenu : undefined}
                      name={authorName()}
                      onOpen={() => {
                        const threadTs = msg()?.threadTs;
                        goTo(
                          item.channelId,
                          item.ts,
                          threadTs && threadTs !== item.ts ? threadTs : undefined,
                        );
                      }}
                      onSplit={() => {
                        const threadTs = msg()?.threadTs;
                        if (threadTs && threadTs !== item.ts) {
                          messageLinks.openThread(item.channelId, threadTs, item.ts, {
                            pinned: true,
                          });
                        } else {
                          openConversationInSplit(item.channelId, item.ts);
                        }
                      }}
                      snippet={
                        <Show
                          fallback={loadError() ? "Couldn't load this message." : "Loading…"}
                          when={isLoaded()}
                        >
                          <Show fallback="Message unavailable" when={msg()}>
                            {(message) => (
                              <MessageReferenceSnippet
                                blocks={message().blocks}
                                botId={message().botId}
                                botUserId={message().userId}
                                channelId={item.channelId}
                                edited={message().edited}
                                text={message().text}
                                threadTs={message().threadTs}
                                ts={message().ts}
                                tz={author()?.tz}
                              />
                            )}
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
                              onClick={() => later.ensureLaterMessageLoaded(item)}
                              type="button"
                            >
                              Retry
                            </button>
                          </Show>
                          <IconButton
                            class="later-remove"
                            disabled={
                              later.laterLoading() ||
                              later.isSaveForLaterPending(item.channelId, item.ts)
                            }
                            icon="bookmark-filled"
                            onClick={() => later.toggleSaveForLater(item.channelId, item.ts)}
                            tone="accent"
                          />
                        </>
                      }
                    />
                    <InlineFeedback
                      class="later-feedback truncate"
                      feedback={feedback.get(item.ts)}
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
