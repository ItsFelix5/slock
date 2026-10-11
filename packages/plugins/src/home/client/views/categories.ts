import type { Channel } from "@slock/types";

export interface Category {
  channels: Channel[];
  custom: boolean;
  filterable: boolean;
  id: string;
  name: string;
  reorderable: boolean;
  sidebar: "hid" | "active" | "all";
}

export function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function sectionShowsAllChannels(
  sidebar: Category["sidebar"],
  unreadsOnly: boolean,
): boolean {
  if (unreadsOnly) return false;
  return sidebar === "all";
}

export function buildCategories(
  allChannels: Channel[],
  sections: () =>
    | {
        id: string;
        name: string;
        channelIds: string[];
        sidebar: "hid" | "active" | "all";
        sort?: "recent";
        type: string;
      }[]
    | undefined,
  unreadsOnly: () => boolean,
  isChannelUnread: (id: string) => boolean,
  isChannelStarred: (id: string) => boolean,
  isChannelLeft: (id: string) => boolean,
  isChannelOpen: (id: string) => boolean,
  isChannelMuted: (id: string) => boolean,
): Category[] {
  const visibleChannels = allChannels.filter((c) => !isChannelLeft(c.id));

  const isUnread = (c: Channel) => isChannelUnread(c.id) && !isChannelMuted(c.id);
  const matches = (c: Channel, sidebar: Category["sidebar"]) => {
    if (isChannelOpen(c.id)) return true;
    return sectionShowsAllChannels(sidebar, unreadsOnly()) || isUnread(c);
  };
  const byId = new Map(visibleChannels.map((c) => [c.id, c]));
  const starredIds = visibleChannels.filter((c) => isChannelStarred(c.id)).map((c) => c.id);
  const secs = sections() ?? [];
  const channelSecs = secs.filter((s) => s.type === "standard" || s.type === "usergroup");
  const usedForRest = new Set<string>(starredIds);
  for (const s of channelSecs) for (const id of s.channelIds) usedForRest.add(id);
  const restChannels = visibleChannels.filter((c) => !usedForRest.has(c.id));
  const claimed = new Set<string>(starredIds);
  const sectionChannelsById = new Map<string, Channel[]>();
  for (const s of channelSecs) {
    const ids = s.channelIds.filter((id) => !claimed.has(id));
    for (const id of ids) claimed.add(id);
    const channels = ids.map((id) => byId.get(id)).filter((c): c is Channel => !!c);

    if (s.sort === "recent") channels.sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
    sectionChannelsById.set(s.id, channels);
  }
  const result: Category[] = [];
  const pushStarred = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (starredIds.length === 0) return;
    const list = starredIds
      .map((cid) => byId.get(cid))
      .filter((c): c is Channel => !!c && matches(c, sidebar));
    if (list.length > 0 || !unreadsOnly())
      result.push({
        channels: list,
        custom: false,
        filterable: false,
        id,
        name: "Starred",
        reorderable,
        sidebar,
      });
  };
  const pushChannels = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "hid") => {
    if (restChannels.length === 0) return;
    const list = restChannels.filter((channel) => matches(channel, sidebar));
    if (list.length > 0 || !unreadsOnly())
      result.push({
        channels: list,
        custom: false,
        filterable: false,
        id,
        name: "Channels",
        reorderable,
        sidebar,
      });
  };
  if (secs.length === 0) {
    pushStarred("__starred", false);
    pushChannels("channels", false);
    return result;
  }
  for (const s of secs) {
    if (s.type === "stars") {
      pushStarred(s.id, true, s.sidebar);
    } else if (s.type === "channels") {
      pushChannels(s.id, true, s.sidebar);
    } else if (s.type === "standard" || s.type === "usergroup") {
      const sectionChannels = sectionChannelsById.get(s.id) ?? [];
      if (s.type === "usergroup" && sectionChannels.length === 0) continue;
      const list = sectionChannels.filter((channel) => matches(channel, s.sidebar));
      if (list.length > 0 || !unreadsOnly())
        result.push({
          channels: list,
          custom: s.type === "standard",
          filterable: true,
          id: s.id,
          name: s.name,
          reorderable: true,
          sidebar: s.sidebar,
        });
    }
  }
  if (!secs.some((s) => s.type === "stars")) pushStarred("__starred", false);
  if (!secs.some((s) => s.type === "channels")) pushChannels("channels", false);
  return result;
}
