import { type BlockKitResolver, noopBlockKitResolver } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { Accessor } from "solid-js";

const viewStore = service("conversations");
const dmsStore = service("dms");
const channelsStore = service("channels");
const usersStore = service("users");
const titles = service("titles");

const dataResolver = {
  onChannelClick: (id: string) => viewStore.setActiveView({ id, kind: "channel" as const }),
  onUserClick: (id: string) => usersStore.openUserProfile(id),
  resolveChannel: (id: string) => {
    const channel = channelsStore.channelById(id);
    if (channel) {
      return {
        isMember: channelsStore.isChannelMember(id),
        isPrivate: channel.private,
        name: titles.title(id),
      };
    }
    const dm = dmsStore.dmById(id);
    return dm ? { isMember: true, isPrivate: true, name: titles.title(id) } : undefined;
  },
  resolveUser: (id: string) => {
    const user = usersStore.userById(id);
    return user ? { isSelf: id === usersStore.currentUser()?.id, name: user.name } : undefined;
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
