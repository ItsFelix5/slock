import type { Channel } from "@slock/slack-api";

export interface Category {
  channels: Channel[];
  custom: boolean;
  id: string;
  name: string;
  reorderable: boolean;
  sidebar: "hid" | "active" | "all";
}
export function buildCategories(
  allChannels: Channel[],
  sections: () =>
    | {
        id: string;
        name: string;
        channelIds: string[];
        sidebar: "hid" | "active" | "all";
        type: string;
      }[]
    | undefined,
  unreadsOnly: () => boolean,
  expandedSectionIds: () => Set<string>,
  unreadChannelIds: Record<string, boolean>,
  isChannelStarred: (id: string) => boolean,
  isChannelLeft: (id: string) => boolean,
): Category[] {
  const visibleChannels = allChannels.filter((c) => !isChannelLeft(c.id));
  // Bootstrap's `unread` value is only an initial snapshot. The reactive map
  // is seeded from it, then receives both additions and clears from Slack and
  // local read actions; consulting the snapshot here would make a cleared
  // unread impossible to remove from filtered sections.
  const isUnread = (c: Channel) => !!unreadChannelIds[c.id];
  const matches = (c: Channel, sectionId: string, sidebar: Category["sidebar"]) => {
    // A section-name click is an explicit "show all" request, including
    // while Home is otherwise in its unread-only mode.
    if (expandedSectionIds().has(sectionId)) return true;
    if (unreadsOnly()) return isUnread(c);
    // "hid" and "active" are Slack's filtered sidebar modes. The API only
    // gives us an active signal through the unread counts, so both restrict
    // the initial list to those active/unread channels.
    return sidebar === "all" || isUnread(c);
  };
  const byId = new Map(visibleChannels.map((c) => [c.id, c]));
  const starredIds = visibleChannels.filter((c) => isChannelStarred(c.id)).map((c) => c.id);
  const secs = sections() ?? [];
  const standardSecs = secs.filter((s) => s.type === "standard");
  const usedForRest = new Set<string>(starredIds);
  for (const s of standardSecs) for (const id of s.channelIds) usedForRest.add(id);
  const restChannels = visibleChannels.filter((c) => !usedForRest.has(c.id));
  const claimed = new Set<string>(starredIds);
  const standardChannelsById = new Map<string, Channel[]>();
  for (const s of standardSecs) {
    const ids = s.channelIds.filter((id) => !claimed.has(id));
    for (const id of ids) claimed.add(id);
    standardChannelsById.set(
      s.id,
      ids.map((id) => byId.get(id)).filter((c): c is Channel => !!c),
    );
  }
  const result: Category[] = [];
  const pushStarred = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (starredIds.length === 0) return;
    const list = starredIds
      .map((cid) => byId.get(cid))
      .filter((c): c is Channel => !!c && matches(c, id, sidebar));
    if (list.length > 0 || !unreadsOnly())
      result.push({ channels: list, custom: false, id, name: "Starred", reorderable, sidebar });
  };
  const pushChannels = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (restChannels.length === 0) return;
    const list = restChannels.filter((channel) => matches(channel, id, sidebar));
    if (list.length > 0 || !unreadsOnly())
      result.push({ channels: list, custom: false, id, name: "Channels", reorderable, sidebar });
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
    } else if (s.type === "standard") {
      const list = (standardChannelsById.get(s.id) ?? []).filter((channel) =>
        matches(channel, s.id, s.sidebar),
      );
      if (list.length > 0 || !unreadsOnly())
        result.push({
          channels: list,
          custom: true,
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
