import { formatSlackDateTokens } from "@slock/blockkit";
import { formatTime } from "@slock/core";
import { service } from "@slock/core/solid";
import {
  openConversation,
  openConversationInSplit,
} from "@slock/plugins/conversations/client/api/nav";
import MessageActionsMenuItems from "@slock/plugins/messages/client/api/cards/MessageActionsMenuItems";
import MessageReferenceSnippet from "@slock/plugins/messages/client/api/cards/MessageReferenceSnippet";
import ResultMessageCard from "@slock/plugins/messages/client/api/cards/ResultMessageCard";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "@slock/plugins/messages/client/api/messageAuthor";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { ChannelId, Message, SavedItem, Ts } from "@slock/types";
import {
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  IconButton,
  InlineFeedback,
  useContextMenu,
} from "@slock/ui";
import { createMemo, Show } from "solid-js";

const feedback = service("feedback");
const messageLinks = service("message-links");
const titles = service("titles");
const usersStore = service("users");
const later = service("later");
const env = service("env");

export default function LaterItemCard(props: {
  failed?: boolean;
  item: SavedItem;
  message: Message | null | undefined;
  onRetry?: () => void;
}) {
  const msg = () => props.message;
  const goTo = (channelId: ChannelId, ts: Ts, rootTs?: Ts) =>
    messageLinks.openChannelMessage(channelId, ts, rootTs);
  const isLoaded = () => msg() !== undefined;
  const loadError = () => !!props.failed;
  const authorId = createMemo(() => {
    const message = msg();
    return message ? resolveProfileUserId(message) : undefined;
  });
  const author = createMemo(() => {
    const id = authorId();
    return id ? usersStore.userById(id) : undefined;
  });
  const authorName = createMemo(() => {
    const message = msg();
    return message ? resolveAuthorDisplayName(message, author()?.name, "Unknown") : "Loading…";
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
          <SplitNavigation onSplit={() => openConversationInSplit(props.item.channelId)}>
            <ClickableInline onActivate={() => openConversation(props.item.channelId)}>
              <span class="result-message-card-context-text">
                {titles.label(props.item.channelId)}
              </span>
            </ClickableInline>
          </SplitNavigation>
        }
        ctxMenu={isLoaded() ? ctxMenu : undefined}
        name={authorName()}
        onOpen={() => {
          const threadTs = msg()?.threadTs;
          goTo(
            props.item.channelId,
            props.item.ts,
            threadTs && threadTs !== props.item.ts ? threadTs : undefined,
          );
        }}
        onSplit={() => {
          const threadTs = msg()?.threadTs;
          messageLinks.openMessageInSplit(
            props.item.channelId,
            props.item.ts,
            threadTs === props.item.ts ? undefined : threadTs,
          );
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
                  channelId={props.item.channelId}
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
        time={formatTime(props.item.ts)}
        timeTitle={timeTitle()}
        userId={authorId()}
        trailing={
          <>
            <Show when={loadError()}>
              <button
                class="later-message-retry btn-reset text-accent"
                onClick={props.onRetry}
                type="button"
              >
                Retry
              </button>
            </Show>
            <IconButton
              class="later-remove"
              disabled={
                later.laterLoading() ||
                later.isSaveForLaterPending(props.item.channelId, props.item.ts)
              }
              icon="bookmark-filled"
              label={
                props.item.dateCreated
                  ? formatSlackDateTokens(
                      "Saved {date_short_pretty} at {time}",
                      props.item.dateCreated,
                      env.now(),
                    )
                  : undefined
              }
              onClick={() => later.toggleSaveForLater(props.item.channelId, props.item.ts)}
              tone="accent"
            />
          </>
        }
      />
      <InlineFeedback
        class="later-feedback truncate"
        feedback={feedback.get(props.item.ts)}
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
              channelId={props.item.channelId}
              msg={message()}
              onClose={ctxMenu.close}
              onEditRequest={() => {
                const { threadTs } = message();
                goTo(
                  props.item.channelId,
                  props.item.ts,
                  threadTs && threadTs !== props.item.ts ? threadTs : undefined,
                );
              }}
              threadTs={message().threadTs}
            />
          </ContextMenu>
        )}
      </Show>
    </div>
  );
}
