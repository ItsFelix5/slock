import { formatDay, formatTime } from "@slock/core";
import { maybeService, service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import {
  openConversation,
  openConversationInSplit,
} from "@slock/plugins/conversations/client/api/nav";
import { copyMessageLink } from "@slock/plugins/message-links/client/api/messageLinks";
import MessageReferenceSnippet from "@slock/plugins/messages/client/api/cards/MessageReferenceSnippet";
import ResultMessageCard from "@slock/plugins/messages/client/api/cards/ResultMessageCard";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "@slock/plugins/messages/client/api/messageAuthor";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { SearchResult } from "@slock/types";
import {
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  Icon,
  MenuItem,
  useContextMenu,
} from "@slock/ui";
import { onSettled, Show } from "solid-js";

const dmsStore = service("dms");
const env = service("env");
const messageLinks = service("message-links");
const titles = service("titles");
const channelsStore = service("channels");
const usersStore = service("users");

const later = maybeService("later");

const isGroupDm = (result: SearchResult) => !!result.channelName?.startsWith("mpdm-");

export default function SearchResultRow(props: {
  onOpen: (result: SearchResult) => void;
  result: SearchResult;
}) {
  const profileUserId = () => resolveProfileUserId(props.result);
  const user = () => {
    const id = profileUserId();
    return id ? usersStore.userById(id) : undefined;
  };
  const displayName = () => resolveAuthorDisplayName(props.result, user()?.name, "Someone");
  const avatarUrl = () => resolveAuthorAvatarUrl(props.result, user()?.avatarUrl);

  onSettled(() => {
    if (isGroupDm(props.result)) dmsStore.ensureMpdm(props.result.channelId);
  });

  const channelLabel = () => {
    const { channelId, channelName } = props.result;
    const dm = dmsStore.dmById(channelId);
    if (dm) return <span class="truncate">{titles.title(dm.id)}</span>;
    if (isGroupDm(props.result)) return <span class="truncate">Group message</span>;
    return (
      <>
        <Icon name={channelIconName(channelsStore.channelById(channelId)?.private)} size={11} />
        <span class="truncate">{channelName ?? channelId}</span>
      </>
    );
  };

  const ctxMenu = useContextMenu();
  const isSaved = () => !!later()?.isSavedForLater(props.result.channelId, props.result.ts);
  const savePending = () =>
    !!later()?.laterLoading() ||
    !!later()?.isSaveForLaterPending(props.result.channelId, props.result.ts);
  const openInSplit = () => {
    const { channelId, threadTs, ts } = props.result;
    messageLinks.openMessageInSplit(channelId, ts, threadTs);
  };

  return (
    <>
      <ResultMessageCard
        avatarUser={{
          avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
          avatarUrl: avatarUrl(),
          id: profileUserId() ?? props.result.userId,
          name: displayName(),
        }}
        context={
          <SplitNavigation onSplit={() => openConversationInSplit(props.result.channelId)}>
            <ClickableInline onActivate={() => openConversation(props.result.channelId)}>
              {channelLabel()}
            </ClickableInline>
          </SplitNavigation>
        }
        ctxMenu={ctxMenu}
        name={displayName()}
        onOpen={() => props.onOpen(props.result)}
        onSplit={openInSplit}
        snippet={
          <span data-search-terms={JSON.stringify(props.result.highlights ?? [])}>
            <MessageReferenceSnippet
              blocks={props.result.blocks}
              botId={props.result.botId}
              botUserId={props.result.userId}
              channelId={props.result.channelId}
              text={props.result.text}
              threadTs={props.result.threadTs}
              ts={props.result.ts}
            />
          </span>
        }
        time={formatTime(props.result.ts)}
        timeTitle={`${formatDay(props.result.ts, env.now())} at ${formatTime(props.result.ts)}`}
        userId={profileUserId()}
      />
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <MenuItem
          icon="link"
          onClick={() => {
            ctxMenu.close();
            copyMessageLink(props.result.channelId, props.result.ts, props.result.threadTs);
          }}
        >
          Copy link
        </MenuItem>
        <MenuItem
          icon="move-to-split-view"
          onClick={() => {
            ctxMenu.close();
            openInSplit();
          }}
        >
          Open in split view
        </MenuItem>
        <Show when={later()}>
          {(laterStore) => (
            <MenuItem
              disabled={savePending()}
              icon={isSaved() ? "bookmark-filled" : "bookmark"}
              onClick={() => {
                ctxMenu.close();
                laterStore().toggleSaveForLater(props.result.channelId, props.result.ts);
              }}
            >
              {isSaved() ? "Remove from Later" : "Save for later"}
            </MenuItem>
          )}
        </Show>
      </ContextMenu>
    </>
  );
}
