import type { Channel } from "@slock/types";

export type DmKind = "people" | "apps";

export interface Category {
  channels: Channel[];
  custom: boolean;
  dm?: DmKind;
  dmIds: string[];
  id: string;
  name: string;
  reorderable: boolean;
  sidebar: "hid" | "active" | "all";
}

export function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function sectionShowsAllChannels(sidebar: Category["sidebar"], unreadsOnly: boolean): boolean {
  if (unreadsOnly) return false;
  return sidebar === "all";
}

export type SectionData = {
  id: string;
  name: string;
  channelIds: string[];
  sidebar: "hid" | "active" | "all";
  sort?: "recent";
  type: string;
};

export type CategoryInput = {
  allChannels: Channel[];
  allDmIds: string[];
  hasDms: (kind: DmKind) => boolean;
  isChannelLeft: (id: string) => boolean;
  isChannelMuted: (id: string) => boolean;
  isChannelOpen: (id: string) => boolean;
  isChannelStarred: (id: string) => boolean;
  isChannelUnread: (id: string) => boolean;
  sections: () => SectionData[] | undefined;
  unreadsOnly: () => boolean;
};

export function buildCategories({
  allChannels,
  allDmIds,
  hasDms,
  isChannelLeft,
  isChannelMuted,
  isChannelOpen,
  isChannelStarred,
  isChannelUnread,
  sections,
  unreadsOnly,
}: CategoryInput): Category[] {
  const visibleChannels = allChannels.filter((c) => !isChannelLeft(c.id));

  const matchesId = (id: string, sidebar: Category["sidebar"]) => {
    if (isChannelOpen(id)) return true;
    return (
      sectionShowsAllChannels(sidebar, unreadsOnly()) ||
      (isChannelUnread(id) && !isChannelMuted(id))
    );
  };
  const matches = (c: Channel, sidebar: Category["sidebar"]) => matchesId(c.id, sidebar);
  const dmIdSet = new Set(allDmIds);
  const byId = new Map(visibleChannels.map((c) => [c.id, c]));
  const starredIds = visibleChannels.filter((c) => isChannelStarred(c.id)).map((c) => c.id);
  const starredDmIds = allDmIds.filter(isChannelStarred);
  const secs = sections() ?? [];
  const channelSecs = secs.filter((s) => s.type === "standard" || s.type === "usergroup");
  const usedForRest = new Set<string>(starredIds);
  for (const s of channelSecs) for (const id of s.channelIds) usedForRest.add(id);
  const restChannels = visibleChannels.filter((c) => !usedForRest.has(c.id));
  const claimed = new Set<string>([...starredIds, ...starredDmIds]);
  const sectionChannelsById = new Map<string, Channel[]>();
  const sectionDmIdsById = new Map<string, string[]>();
  for (const s of channelSecs) {
    const ids = s.channelIds.filter((id) => !claimed.has(id));
    for (const id of ids) claimed.add(id);
    const channels = ids.map((id) => byId.get(id)).filter((c): c is Channel => !!c);

    if (s.sort === "recent") channels.sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
    sectionChannelsById.set(s.id, channels);
    sectionDmIdsById.set(
      s.id,
      ids.filter((id) => dmIdSet.has(id)),
    );
  }
  const result: Category[] = [];
  const pushStarred = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (starredIds.length + starredDmIds.length === 0) return;
    const list = starredIds
      .map((cid) => byId.get(cid))
      .filter((c): c is Channel => !!c && matches(c, sidebar));
    const dmIds = starredDmIds.filter((id) => matchesId(id, sidebar));
    if (list.length + dmIds.length > 0 || !unreadsOnly())
      result.push({
        channels: list,
        custom: false,
        dmIds,
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
        dmIds: [],
        id,
        name: "Channels",
        reorderable,
        sidebar,
      });
  };
  const pushDms = (id: string, dm: DmKind, reorderable: boolean) => {
    if (!hasDms(dm)) return;
    result.push({
      channels: [],
      custom: false,
      dm,
      dmIds: [],
      id,
      name: dm === "people" ? "Direct messages" : "Apps",
      reorderable,
      sidebar: "all",
    });
  };
  const appendMissing = () => {
    if (!secs.some((s) => s.type === "stars")) pushStarred("__starred", false);
    if (!secs.some((s) => s.type === "channels")) pushChannels("channels", false);
    if (!secs.some((s) => s.type === "direct_messages")) pushDms("__dms", "people", false);
    if (!secs.some((s) => s.type === "recent_apps")) pushDms("__apps", "apps", false);
    return result;
  };
  if (secs.length === 0) return appendMissing();
  for (const s of secs) {
    if (s.type === "stars") {
      pushStarred(s.id, true, s.sidebar);
    } else if (s.type === "channels") {
      pushChannels(s.id, true, s.sidebar);
    } else if (s.type === "direct_messages") {
      pushDms(s.id, "people", true);
    } else if (s.type === "recent_apps") {
      pushDms(s.id, "apps", true);
    } else if (s.type === "standard" || s.type === "usergroup") {
      const sectionChannels = sectionChannelsById.get(s.id) ?? [];
      if (s.type === "usergroup" && sectionChannels.length === 0) continue;
      const list = sectionChannels.filter((channel) => matches(channel, s.sidebar));
      const dmIds = (sectionDmIdsById.get(s.id) ?? []).filter((id) => matchesId(id, s.sidebar));
      if (list.length + dmIds.length > 0 || !unreadsOnly())
        result.push({
          channels: list,
          custom: s.type === "standard",
          dmIds,
          id: s.id,
          name: s.name,
          reorderable: true,
          sidebar: s.sidebar,
        });
    }
  }
  return appendMissing();
}
