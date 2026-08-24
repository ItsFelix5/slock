import type { BlockKitResolver } from "@slock/blockkit";
import ChannelHoverCard from "../components/channel/channel-details/ChannelHoverCard";
import MessageLinkHoverCard from "../components/messages/parts/MessageLinkHoverCard";
import { openConversationInSplit, SplitNavigation } from "../components/navigation/SplitNavigation";
import UserHoverCard from "../components/user/UserHoverCard";
import UsergroupHoverCard from "../components/usergroup/UsergroupHoverCard";
import { channelDisplayName, dmDisplayName } from "./displayName";
import { parseSlackPermalink } from "./navigation/slackPermalink";
import { store } from "./store";
import { openUsergroupDetails } from "./usergroupDetails";

export const blockKitResolver: BlockKitResolver = {
  onCanvasClick: (fileId, title) => store.canvas.openCanvasPane(fileId, title ?? "canvas"),
  onChannelClick: (id) => store.viewState.setActiveView({ id, kind: "channel" }),
  onUserClick: store.users.openUserProfile,
  onUsergroupClick: openUsergroupDetails,
  resolveChannel: (id) => {
    const channel = store.channels.channelById(id);
    if (channel) {
      return {
        isMember: store.channels.isChannelMember(id),
        isPrivate: channel.private,
        name: channelDisplayName(channel),
      };
    }
    const dm = store.dms.dmById(id);
    return dm
      ? { isMember: true, isPrivate: true, name: dmDisplayName(dm, store.users.userById) || id }
      : undefined;
  },
  resolveUser: (id) => {
    const user = store.users.userById(id);
    return user ? { isSelf: id === store.users.currentUser()?.id, name: user.name } : undefined;
  },
  resolveUsergroup: (id) => {
    const usergroup = store.usergroups.usergroupById(id);
    return usergroup
      ? { isSelf: store.usergroups.isSelfMember(id), name: usergroup.name }
      : undefined;
  },
  wrapChannelMention: (id, trigger) => (
    <SplitNavigation onSplit={() => openConversationInSplit(id)}>
      <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
    </SplitNavigation>
  ),
  wrapLink: (url, trigger) => {
    const target = parseSlackPermalink(url);
    return target ? (
      <SplitNavigation onSplit={() => openConversationInSplit(target.channelId, target.threadTs)}>
        <MessageLinkHoverCard
          channelId={target.channelId}
          messageTs={target.messageTs}
          threadTs={target.threadTs}
        >
          {trigger}
        </MessageLinkHoverCard>
      </SplitNavigation>
    ) : (
      trigger
    );
  },
  wrapUserMention: (id, trigger) => <UserHoverCard userId={id}>{trigger}</UserHoverCard>,
  wrapUsergroupMention: (id, trigger) => (
    <UsergroupHoverCard usergroupId={id}>{trigger}</UsergroupHoverCard>
  ),
};
