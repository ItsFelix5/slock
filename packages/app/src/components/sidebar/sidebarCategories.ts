import type { Channel, ChannelSection, DirectMessage, User } from "@slock/slack-api";
import type { createKeyedFeedback } from "@slock/ui";
import type { Accessor, Setter } from "solid-js";
import type { Nav } from "../../lib/store";

export interface Category {
  channels: Channel[];
  custom: boolean;
  filterable: boolean;
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
  commitRename: () => Promise<void>;
  currentUser: Accessor<User | undefined>;
  deleteChannelSection: (sectionId: string) => Promise<boolean>;
  dmsOpen: Accessor<boolean>;
  toggledSectionFilterIds: Accessor<Set<string>>;
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
  canMoveSection: (sectionId: string, direction: -1 | 1) => boolean;
  moveSection: (sectionId: string, direction: -1 | 1) => void;
  nav: Accessor<Nav>;
  openUserProfile: (id: string) => void;
  peopleDms: Accessor<DirectMessage[]>;
  preferencesError: Accessor<unknown>;
  preferencesLoading: Accessor<boolean>;
  renameValue: Accessor<string>;
  renamingId: Accessor<string | null>;
  retryPreferences: () => Promise<unknown>;
  retrySections: () => Promise<unknown>;
  setRenamingId: Setter<string | null>;
  searchOpen: Accessor<boolean>;
  sectionMenuOpen: Accessor<string | null>;
  sectionsError: Accessor<unknown>;
  sectionsLoading: Accessor<boolean>;
  isSectionSidebarPending: (sectionId: string) => boolean;
  sectionStructurePending: Accessor<boolean>;
  setAppsOpen: Setter<boolean>;
  setDmsOpen: Setter<boolean>;
  setUnreadDmsOpen: Setter<boolean>;
  toggleSectionFilter: (id: string) => void;
  setFeedWidth: Setter<number>;
  setNavView: (next: Nav) => void;
  setRenameValue: Setter<string>;
  setSearchOpen: Setter<boolean>;
  setSectionMenuOpen: Setter<string | null>;
  setChannelSectionSidebar: (
    sectionId: string,
    sidebar: ChannelSection["sidebar"],
  ) => Promise<boolean>;
  setSettingsOpen: Setter<boolean>;
  settingsOpen: Accessor<boolean>;
  setUnreadsOnly: Setter<boolean>;
  setWidth: Setter<number>;
  startRename: (cat: Category) => void;
  toggleCategory: (id: string) => void;
  unreadChannelIds: Record<string, boolean>;
  unreadDms: Accessor<DirectMessage[]>;
  unreadDmsOpen: Accessor<boolean>;
  unreadsOnly: Accessor<boolean>;
  width: Accessor<number>;
}

export function sectionShowsAllChannels(
  sidebar: Category["sidebar"],
  unreadsOnly: boolean,
  filterToggled: boolean,
): boolean {
  // The global Unreads filter always wins: a section's own sidebar setting or
  // its per-section filter toggle must never bring read channels back once
  // the user has asked to see unreads only.
  if (unreadsOnly) return false;
  const filteredByDefault = sidebar !== "all";
  return filterToggled ? filteredByDefault : !filteredByDefault;
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
  toggledSectionFilterIds: () => Set<string>,
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
    // The shared section-name action flips the section's effective filter:
    // all -> unread, or unread/active -> all. It also inverts Home's global
    // unread-only filter for this one section.
    return (
      sectionShowsAllChannels(sidebar, unreadsOnly(), toggledSectionFilterIds().has(sectionId)) ||
      isUnread(c)
    );
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
    // Slack's channel_ids order is always the manual drag order. A section
    // set to sort by recent activity instead shows its channels ranked by
    // their own last activity, live, rather than that static server order.
    if (s.sort === "recent") channels.sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
    sectionChannelsById.set(s.id, channels);
  }
  const result: Category[] = [];
  const pushStarred = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (starredIds.length === 0) return;
    const list = starredIds
      .map((cid) => byId.get(cid))
      .filter((c): c is Channel => !!c && matches(c, id, sidebar));
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
  const pushChannels = (id: string, reorderable: boolean, sidebar: Category["sidebar"] = "all") => {
    if (restChannels.length === 0) return;
    const list = restChannels.filter((channel) => matches(channel, id, sidebar));
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
      const list = sectionChannels.filter((channel) => matches(channel, s.id, s.sidebar));
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
