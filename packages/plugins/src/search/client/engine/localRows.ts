import { service } from "@slock/core/solid";
import type { BrowsableChannel, User } from "@slock/types";
import { rankJumps } from "./jumpRanking";
import { type JumpRow, personRow } from "./rows";

const bootstrapStore = service("bootstrap");
const channelsStore = service("channels");
const dmsStore = service("dms");
const prefsStore = service("prefs");
const titles = service("titles");
const usersStore = service("users");

const RECENT_LIMIT = 30;

export const directoryReady = () => !!bootstrapStore.bootstrap().data;

function frecency(row: JumpRow): number {
  const id = row.kind === "person" ? dmsStore.dmIdForUser(row.user.id) : row.id;
  return id ? prefsStore.frecencyScore(id) : 0;
}

export function jumpRows(
  term: string,
  remoteChannels: BrowsableChannel[],
  remoteUsers: User[],
): JumpRow[] {
  const groups = dmsStore
    .directMessages()
    .filter((dm) => dm.memberIds)
    .map((dm) => ({ dm, title: titles.title(dm.id) }));
  const channels = channelsStore.channels();
  const users = usersStore.knownUsers();
  return rankJumps(term, { channels, groups, remoteChannels, remoteUsers, users }, frecency);
}

export function recentRows(): JumpRow[] {
  return prefsStore
    .recentIds()
    .flatMap((id): JumpRow[] => {
      const channel = channelsStore.channelById(id);
      if (channel) return [{ id, kind: "channel", name: channel.name, private: channel.private }];
      const dm = dmsStore.dmById(id);
      if (!dm) return [];
      const user = dm.userId ? usersStore.userById(dm.userId) : undefined;
      return [user ? personRow(user) : { dm, id: dm.id, kind: "dm" }];
    })
    .slice(0, RECENT_LIMIT);
}
