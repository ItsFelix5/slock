import type { EntityKind, EntitySource } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { Channel, ConversationFilter, User } from "@slock/types";
import { type ComboboxOption, fuzzySearch } from "@slock/ui";
import { channelIconName } from "../../channels/client/api";
import { fetchBrowsableChannels, openDm } from "../../slack/client/api";

const usersStore = service("users");
const channelsStore = service("channels");
const dmsStore = service("dms");
const conversations = service("conversations");
const titles = service("titles");

const LIMIT = 50;

type ChannelData = Pick<Channel, "id" | "name" | "private">;

const userOption = (user: User): ComboboxOption => ({
  avatar: user,
  id: user.id,
  label: user.name,
});

const channelOption = (channel: ChannelData): ComboboxOption => ({
  icon: channelIconName(channel.private),
  id: channel.id,
  label: channel.name,
});

function ranked(items: ComboboxOption[], query: string) {
  return fuzzySearch(items, { query, text: (item) => item.label }).slice(0, LIMIT);
}

async function findUsers(query: string) {
  const merged = new Map(usersStore.knownUsers().map((user) => [user.id, user]));
  if (query) {
    for (const user of await usersStore.searchUsers(query).catch(() => [])) {
      merged.set(user.id, user);
    }
  }
  return [...merged.values()];
}

async function findChannels(query: string, include: Set<string>) {
  const merged = new Map<string, ChannelData>(
    channelsStore.channels().map((channel) => [channel.id, channel]),
  );
  if (query) {
    for (const channel of await fetchBrowsableChannels(query).catch(() => [])) {
      merged.set(channel.id, channel);
    }
  }
  return [...merged.values()]
    .filter((channel) => include.has(channel.private ? "private" : "public"))
    .map(channelOption);
}

function dmOption(dm: { id: string; userId?: string }): ComboboxOption {
  const user = dm.userId ? usersStore.userById(dm.userId) : undefined;
  return user
    ? { avatar: user, id: dm.id, label: user.name }
    : { icon: "user-groups", id: dm.id, label: titles.title(dm.id) };
}

async function findConversations(query: string, filter?: ConversationFilter) {
  const include = new Set(filter?.include ?? ["public", "private", "mpim", "im"]);
  const channels = await findChannels(query, include);
  const dms = dmsStore
    .directMessages()
    .filter((dm) => include.has(dm.userId ? "im" : "mpim"))
    .map(dmOption);
  const newDms = include.has("im")
    ? (await findUsers(query))
        .filter(
          (user) => user.id !== usersStore.currentUser()?.id && !dmsStore.dmIdForUser(user.id),
        )
        .map(userOption)
    : [];
  return ranked([...channels, ...dms, ...newDms], query);
}

function describe(kind: EntityKind, id: string): ComboboxOption {
  const user = usersStore.userById(id);
  if (user) return userOption(user);
  if (kind === "conversations") {
    const dm = dmsStore.dmById(id);
    if (dm) return dmOption(dm);
  }
  return {
    icon: channelIconName(channelsStore.channelById(id)?.private),
    id,
    label: titles.title(id),
  };
}

async function conversationId(id: string) {
  if (!usersStore.userById(id)) return id;
  const existing = dmsStore.dmIdForUser(id);
  if (existing) return existing;
  const channelId = await openDm(id);
  if (!channelId) throw new Error("Could not open a direct message");
  dmsStore.ensureDm(channelId, id);
  return channelId;
}

export function createEntitySource(lastOpenedConversation: () => string | undefined): EntitySource {
  return {
    conversationId,
    currentConversation: () => conversations.activeView()?.id ?? lastOpenedConversation(),
    describe,
    search: async (kind, query, filter) =>
      kind === "users"
        ? ranked((await findUsers(query)).map(userOption), query)
        : kind === "channels"
          ? ranked(await findChannels(query, new Set(["public"])), query)
          : findConversations(query, filter),
  };
}
