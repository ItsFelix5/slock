import { type BlockKitResolver, noopBlockKitResolver } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { ChannelId, UserId } from "@slock/types";
import type { Accessor } from "solid-js";

const viewStore = service("conversations");
const dmsStore = service("dms");
const channelsStore = service("channels");
const usersStore = service("users");
const titles = service("titles");

const dataResolver = {
  onChannelClick: (id: ChannelId) => viewStore.setActiveView({ id, kind: "channel" }),
  onUserClick: (id: UserId) => usersStore.openUserProfile(id),
  resolveChannel: (id: ChannelId) => {
    const channel = channelsStore.channelById(id);
    if (channel) {
      return {
        isMember: channelsStore.isChannelMember(id),
        isPrivate: channel.private,
        name: titles.title(id),
        label: titles.label(id),
      };
    }
    const dm = dmsStore.dmById(id);
    return dm
      ? { isMember: true, isPrivate: true, name: titles.title(id), label: titles.label(id) }
      : undefined;
  },
  resolveUser: (id: UserId) => {
    const user = usersStore.userById(id);
    return user ? { isSelf: id === usersStore.currentUserId(), name: user.name } : undefined;
  },
};

export function createBlockKitResolver(contributions: Accessor<Partial<BlockKitResolver>[]>) {
  const merged = () => ({
    ...noopBlockKitResolver,
    ...dataResolver,
    ...Object.assign({}, ...contributions()),
  });
  return new Proxy(noopBlockKitResolver, {
    get: (_, key) => Reflect.get(merged(), key),
  });
}
