import { Mrkdwn } from "@slock/blockkit";
import { formatTime } from "@slock/slack-api";
import { Button, DEFAULT_AVATAR_COLOR, IconButton, InlineFeedback } from "@slock/ui";
import { createMemo, For, onMount, Show } from "solid-js";
import { openConversationInSplit } from "../../components/navigation/SplitNavigation";
import { actionFeedback, conversationDisplayName, store } from "../../lib/store";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../messages/parts/messageRenderState";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import "./LaterView.css";

export default function LaterView() {
  onMount(() => store.later.ensureLaterLoaded());

  const goTo = (channelId: string, ts: string, highlightTs?: string) =>
    store.viewState.openChannelPeek(channelId, ts, highlightTs, { keepNav: true });

  return (
    <div class="later-view sidebar-view-panel">
      <h2>Later</h2>
      <Show
        fallback={
          <div class="later-empty empty-state" role="status">
            Loading saved items…
          </div>
        }
        when={store.later.laterLoaded() || store.later.laterLoadError()}
      >
        <Show
          fallback={
            <div class="later-load-error empty-state flex-col" role="alert">
              <span>Couldn’t load saved items.</span>
              <Button onClick={store.later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          }
          when={store.later.laterLoaded() || !store.later.laterLoadError()}
        >
          <Show when={store.later.laterLoading() && store.later.laterLoaded()}>
            <div class="later-load-notice text-dim text-sm" role="status">
              Refreshing saved items…
            </div>
          </Show>
          <Show when={store.later.laterLoadError() && store.later.laterLoaded()}>
            <div class="later-load-notice later-load-warning" role="alert">
              <span>Couldn’t refresh saved items.</span>
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
                // channelById triggers a network discovery lookup for unknown
                // ids — skip it for DM ids, which will never resolve as a channel.
                const channel = createMemo(() =>
                  item.channelId.startsWith("D")
                    ? undefined
                    : store.channels.channelById(item.channelId),
                );
                const dm = createMemo(() => store.dms.dmById(item.channelId));
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
                return (
                  <div class="later-item">
                    <ResultMessageCard
                      avatarUser={{
                        avatarColor: author()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                        avatarUrl: avatarUrl(),
                        id: authorId() ?? "",
                        name: authorName(),
                      }}
                      context={conversationDisplayName(
                        item.channelId,
                        channel(),
                        dm(),
                        store.users.userById,
                      )}
                      name={authorName()}
                      navRow
                      onOpen={() => {
                        const rootTs = msg()?.threadTs;
                        goTo(item.channelId, rootTs ?? item.ts, rootTs ? item.ts : undefined);
                      }}
                      onSplit={() => {
                        const rootTs = msg()?.threadTs;
                        openConversationInSplit(item.channelId, rootTs ?? item.ts);
                      }}
                      snippet={
                        <Show
                          fallback={loadError() ? "Couldn’t load this message." : "Loading…"}
                          when={isLoaded()}
                        >
                          <Show fallback="Message unavailable" when={msg()}>
                            {(message) => <Mrkdwn text={message().text} />}
                          </Show>
                        </Show>
                      }
                      time={formatTime(item.ts)}
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
