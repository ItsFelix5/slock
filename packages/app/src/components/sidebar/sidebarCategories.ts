import type { Channel, ChannelSection, DirectMessage, User } from "@slock/slack-api";
import type { createKeyedFeedback } from "@slock/ui";
import type { Accessor, Setter } from "solid-js";
import type { Nav } from "../../lib/store";

export interface Category {
  channels: Channel[];
  custom: boolean;
  id: string;
  name: string;
  reorderable: boolean;
  sidebar: "hid" | "active" | "all";
}

type KeyedFeedback = ReturnType<typeof createKeyedFeedback>;

export interface SidebarContext {
  actionFeedback: KeyedFeedback;
  appDms: Accessor<DirectMessage[]>;
  appsOpen: Accessor<boolean>;
  bootstrap: { loading: boolean };
  categories: Accessor<Category[]>;
  collapsed: Accessor<Set<string>>;
  commitRename: () => void;
  currentUser: Accessor<User | undefined>;
  deleteChannelSection: (sectionId: string) => Promise<void>;
  dmsOpen: Accessor<boolean>;
  expandedSectionIds: Accessor<Set<string>>;
  draggingSectionId: Accessor<string | null>;
  dropTarget: Accessor<{ id: string; before: boolean } | null>;
  feedMaxWidth: number;
  feedMinWidth: number;
  feedMode: Accessor<boolean>;
  feedWidth: Accessor<number>;
  handleSectionDragEnd: () => void;
  handleSectionDragLeave: (id: string) => void;
  handleSectionDragOver: (e: DragEvent, id: string) => void;
  handleSectionDragStart: (e: DragEvent, id: string) => void;
  handleSectionDrop: (e: DragEvent) => void;
  hasUnreadActivity: Accessor<boolean>;
  unreadPingCount: Accessor<number>;
  maxWidth: number;
  minWidth: number;
  nav: Accessor<Nav>;
  openUserProfile: (id: string) => void;
  peopleDms: Accessor<DirectMessage[]>;
  renameValue: Accessor<string>;
  renamingId: Accessor<string | null>;
  setRenamingId: Setter<string | null>;
  searchOpen: Accessor<boolean>;
  sectionMenuOpen: Accessor<string | null>;
  setAppsOpen: Setter<boolean>;
  setDmsOpen: Setter<boolean>;
  showAllInCategory: (id: string) => void;
  setFeedWidth: Setter<number>;
  setNavView: (next: Nav) => void;
  setRenameValue: Setter<string>;
  setSearchOpen: Setter<boolean>;
  setSectionMenuOpen: Setter<string | null>;
  setChannelSectionSidebar: (
    sectionId: string,
    sidebar: ChannelSection["sidebar"],
  ) => Promise<void>;
  setSettingsOpen: Setter<boolean>;
  settingsOpen: Accessor<boolean>;
  setUnreadsOnly: Setter<boolean>;
  setWidth: Setter<number>;
  startRename: (cat: Category) => void;
  toggleCategory: (id: string) => void;
  unreadChannelIds: Record<string, boolean>;
  unreadsOnly: Accessor<boolean>;
  width: Accessor<number>;
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
  isChannelOpen: (id: string) => boolean,
  isChannelMuted: (id: string) => boolean,
): Category[] {
  const visibleChannels = allChannels.filter((c) => !isChannelLeft(c.id));
  // Bootstrap's `unread` value is only an initial snapshot. The reactive map
  // is seeded from it, then receives both additions and clears from Slack and
  // local read actions; consulting the snapshot here would make a cleared
  // unread impossible to remove from filtered sections. A muted channel
  // never counts as "unread" for filtering purposes, even with unread
  // messages, so it drops out of unread-only views instead of lingering.
  const isUnread = (c: Channel) => !!unreadChannelIds[c.id] && !isChannelMuted(c.id);
  const matches = (c: Channel, sectionId: string, sidebar: Category["sidebar"]) => {
    // Opening a channel clears its unread state. Keep it in the sidebar even
    // when that would otherwise make it disappear from a filtered section.
    if (isChannelOpen(c.id)) return true;
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
