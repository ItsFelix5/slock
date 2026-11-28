import { formatDay, formatShortWhenFromMs, formatTime } from "@slock/core";
import { service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import MessageReferenceSnippet from "@slock/plugins/messages/client/api/cards/MessageReferenceSnippet";
import ResultMessageCard from "@slock/plugins/messages/client/api/cards/ResultMessageCard";
import {
  resolveMessageAuthorAvatar,
  resolveProfileUserId,
} from "@slock/plugins/messages/client/api/messageAuthor";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { SearchResult } from "@slock/types";
import { ClickableInline, Icon, useContextMenu } from "@slock/ui";
import { onSettled, Show } from "solid-js";
import type { SearchSession } from "../../engine/session";
import MessageRowMenu from "./MessageRowMenu";

const channelsStore = service("channels");
const dmsStore = service("dms");
const env = service("env");
const titles = service("titles");
const usersStore = service("users");

export default function MessageRow(props: {
  active: boolean;
  message: SearchResult;
  onActivate: (split: boolean) => void;
  onHover: () => void;
  session: SearchSession;
}) {
  const author = () => resolveMessageAuthorAvatar(props.message, usersStore.userById);
  const isGroupDm = () => !!props.message.channelName?.startsWith("mpdm-");
  const isPrivate = () => !!channelsStore.channelById(props.message.channelId)?.private;
  const menu = useContextMenu();

  onSettled(() => {
    if (isGroupDm()) dmsStore.ensureMpdm(props.message.channelId);
  });

  const openChannel = (split: boolean) => {
    const { channelId, channelName } = props.message;
    const name = channelName ?? channelId;
    props.session.open({ id: channelId, kind: "channel", name, private: isPrivate() }, split);
  };
  const contextLabel = () => {
    const { channelId, channelName } = props.message;
    if (dmsStore.dmById(channelId)) {
      return <span class="truncate">{titles.title(channelId)}</span>;
    }
    if (isGroupDm()) return <span class="truncate">Group message</span>;
    return (
      <>
        <Icon name={channelIconName(isPrivate())} size={11} />
        <span class="truncate">{channelName ?? channelId}</span>
      </>
    );
  };
  const sentAt = () =>
    `${formatDay(props.message.ts, env.now())} at ${formatTime(props.message.ts)}`;

  return (
    <div class={["search-message", { active: props.active }]} onMouseMove={() => props.onHover()}>
      <ResultMessageCard
        avatarUser={author()}
        context={
          <SplitNavigation onSplit={() => openChannel(true)}>
            <ClickableInline onActivate={() => openChannel(false)}>
              {contextLabel()}
            </ClickableInline>
          </SplitNavigation>
        }
        ctxMenu={menu}
        name={author().name}
        onOpen={() => props.onActivate(false)}
        onSplit={() => props.onActivate(true)}
        snippet={
          <span data-search-terms={JSON.stringify(props.message.highlights ?? [])}>
            <MessageReferenceSnippet
              attachments={props.message.attachments}
              blocks={props.message.blocks}
              botId={props.message.botId}
              botTeamId={props.message.botTeamId}
              botUserId={props.message.userId}
              channelId={props.message.channelId}
              files={props.message.files}
              text={props.message.text}
              threadTs={props.message.threadTs}
              ts={props.message.ts}
            />
          </span>
        }
        time={formatShortWhenFromMs(Number(props.message.ts) * 1000, env.now())}
        timeTitle={sentAt()}
        userId={resolveProfileUserId(props.message)}
      />
      <Show when={menu.isOpen()}>
        <MessageRowMenu
          menu={menu}
          message={props.message}
          onSplit={() => props.onActivate(true)}
        />
      </Show>
    </div>
  );
}
