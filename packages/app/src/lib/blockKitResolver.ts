import { channelDisplayName, dmDisplayName } from "./displayName";
import { store } from "./store";
import { openUsergroupDetails } from "./usergroupDetails";

export const blockKitDataResolver = {
  onCanvasClick: (fileId: string, title?: string) => store.canvas.openCanvasPane(fileId, title),
  onChannelClick: (id: string) => store.viewState.setActiveView({ id, kind: "channel" as const }),
  onUserClick: store.users.openUserProfile,
  onUsergroupClick: openUsergroupDetails,
  resolveChannel: (id: string) => {
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
  resolveUser: (id: string) => {
    const user = store.users.userById(id);
    return user ? { isSelf: id === store.users.currentUser()?.id, name: user.name } : undefined;
  },
  resolveUsergroup: (id: string) => {
    const usergroup = store.usergroups.usergroupById(id);
    return usergroup
      ? { isSelf: store.usergroups.isSelfMember(id), name: usergroup.name }
      : undefined;
  },
};
