import { service } from "@slock/core/solid";
import { defineMutation, definePagedQuery, defineQuery } from "@slock/plugins/query/client/api";
import { fetchChannelMembers } from "@slock/plugins/slack/client/api";
import type { ChannelId, User, UserId } from "@slock/types";
import { refreshHeadcount } from "./headcount";
import { addChannelManager, inviteToChannel, removeFromChannel } from "./requests";

const channelsStore = service("channels");
const feedback = service("feedback");
const usersStore = service("users");

export type MemberFilter = "everyone" | "managers" | "apps";
type PagedFilter = Exclude<MemberFilter, "managers">;

export interface MembersArg {
  channelId: ChannelId;
  filter: PagedFilter;
}

export const memberPages = definePagedQuery<MembersArg, User>({
  itemKey: (user) => user.id,
  load: async ({ channelId, filter }, cursor, { signal }) => {
    try {
      const page = await fetchChannelMembers(channelId, filter, cursor, undefined, signal);
      return { items: page.members, next: page.nextCursor };
    } catch (error) {
      if (!signal.aborted) feedback.caught(channelId, error, "Failed to load members.");
      throw error;
    }
  },
  maxAgeMs: 60_000,
  name: "channelMemberPages",
});

function editPage(arg: MembersArg, change: (members: User[]) => User[]) {
  memberPages.modify(arg, (paged) => ({ ...paged, items: change(paged.items) }));
}

interface MemberSearch {
  channelId: ChannelId;
  directory: boolean;
  term: string;
}

async function searchChannel(channelId: ChannelId, term: string, signal: AbortSignal) {
  try {
    return (await fetchChannelMembers(channelId, "everyone", undefined, term, signal)).members;
  } catch (error) {
    if (!signal.aborted) feedback.caught(channelId, error, "Failed to search members.");
    throw error;
  }
}

export const memberMatches = defineQuery<MemberSearch, { directory: User[]; inChannel: User[] }>({
  load: async ({ channelId, directory, term }, { signal }) => {
    const [inChannel, found] = await Promise.all([
      searchChannel(channelId, term, signal),
      directory ? usersStore.searchUsers(term) : [],
    ]);
    return { directory: found, inChannel };
  },
  maxAgeMs: 30_000,
  name: "channelMemberMatches",
});

export const memberKey = (channelId: ChannelId, userId: UserId) => `${channelId}:${userId}`;

interface MemberChange {
  channelId: ChannelId;
  user: User;
}

function memberMutation(
  failure: string,
  request: (channelId: ChannelId, userId: UserId) => Promise<void>,
  apply: (change: MemberChange) => void,
) {
  return defineMutation<MemberChange>({
    key: ({ channelId, user }) => memberKey(channelId, user.id),
    mode: "single",
    onError: (error, { channelId }) => feedback.caught(channelId, error, failure),
    onSuccess: (_, change) => {
      apply(change);
      memberMatches.invalidateWhere((search) => search.channelId === change.channelId);
      refreshHeadcount(change.channelId);
    },
    run: ({ channelId, user }) => request(channelId, user.id),
  });
}

export const adding = memberMutation(
  "Failed to add to channel.",
  (channelId, userId) => inviteToChannel(channelId, [userId]),
  ({ channelId, user }) => {
    editPage({ channelId, filter: "everyone" }, (members) =>
      members.some((member) => member.id === user.id) ? members : [user, ...members],
    );
    if (user.isBot) memberPages.invalidate({ channelId, filter: "apps" });
    channelsStore.invalidateChannelRoster(channelId);
  },
);

export const removing = memberMutation(
  "Failed to remove from channel.",
  removeFromChannel,
  ({ channelId, user }) => {
    for (const filter of ["everyone", "apps"] as const)
      editPage({ channelId, filter }, (members) =>
        members.filter((member) => member.id !== user.id),
      );
    channelsStore.updateChannelManagers(
      channelId,
      (ids) => new Set([...ids].filter((id) => id !== user.id)),
    );
    channelsStore.invalidateChannelRoster(channelId);
  },
);

export const promoting = memberMutation(
  "Failed to make channel manager.",
  addChannelManager,
  ({ channelId, user }) =>
    channelsStore.updateChannelManagers(channelId, (ids) => new Set([...ids, user.id])),
);
