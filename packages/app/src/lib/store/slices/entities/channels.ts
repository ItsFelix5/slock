import type { BrowsableChannel, Channel, ChannelSection, UserPrefs } from "@slock/slack-api";
import {
  fetchBrowsableChannels,
  fetchChannel,
  fetchChannelDetails,
  fetchChannelMembers,
  joinChannel,
  leaveChannel,
} from "@slock/slack-api";
import { createEffect, createMemo, createSignal, type Setter } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { Nav, View } from "../types";
import { createChannelSections } from "./channelSections";
import { createChannelStarPlacement } from "./channelStarPlacement";

export function createChannelsSlice(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: string[] } | undefined;
  activeView: () => View | null;
  nav: () => Nav;
  setActiveView: (view: View) => void;
  usergroupSections: () => ChannelSection[];
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: Setter<UserPrefs | undefined>;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);

  const [discoveredChannels, setDiscoveredChannels] = createStore<Channel[]>([]);
  const pendingChannels = new Set<string>();
  const channelDiscoveryMisses = new Map<string, number>();
  const channelDiscoveryRetryMs = 30_000;
  const channelDetailsRequested = new Set<string>();

  const [channelPatches, setChannelPatches] = createStore<Record<string, Partial<Channel>>>({});
  const [leftChannelIds, setLeftChannelIds] = createStore<Record<string, boolean>>({});
  const [joinPendingIds, setJoinPendingIds] = createStore<Record<string, boolean>>({});
  const [leavePendingIds, setLeavePendingIds] = createStore<Record<string, boolean>>({});
  let starredSeeded = false;
  const [browsableChannels, setBrowsableChannels] = createSignal<BrowsableChannel[]>([]);

  const channelSections = createChannelSections({
    mutateUserPrefs: deps.mutateUserPrefs,
    nav: deps.nav,
    usergroupSections: deps.usergroupSections,
    userPrefs: deps.userPrefs,
  });
  const {
    isChannelPlacementPending,
    isChannelStarred,
    moveChannelToSection,
    setStarredChannelIds,
    toggleChannelStar,
  } = createChannelStarPlacement({
    refreshSections: channelSections.retrySections,
    sections: channelSections.sections,
    sectionStructurePending: channelSections.sectionStructurePending,
    setSectionStructurePending: channelSections.setSectionStructurePending,
  });

  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || starredSeeded) return;
    starredSeeded = true;
    for (const id of data.starredChannelIds) setStarredChannelIds(id, true);
  });

  const channels = createMemo<Channel[]>(() => {
    const base = deps.bootstrap()?.channels ?? [];
    const extra = extraChannels.filter((c) => !base.some((b) => b.id === c.id));
    return [...base, ...extra].map((c) =>
      channelPatches[c.id] ? { ...c, ...channelPatches[c.id] } : c,
    );
  });

  function patchChannel(id: string, patch: Partial<Channel>) {
    setChannelPatches(id, { ...channelPatches[id], ...patch });
  }

  async function discoverChannel(id: string): Promise<boolean> {
    const channel = await fetchChannel(id);
    if (!channel) return false;
    setDiscoveredChannels(produce((list) => list.push(channel)));
    return true;
  }

  function channelById(id: string): Channel | undefined {
    const known =
      channels().find((c) => c.id === id) ?? discoveredChannels.find((c) => c.id === id);
    if (known) return known;

    if (!deps.bootstrap()) return;
    const missedAt = channelDiscoveryMisses.get(id);
    if (missedAt && Date.now() - missedAt < channelDiscoveryRetryMs) return;
    if (!pendingChannels.has(id)) {
      pendingChannels.add(id);
      discoverChannel(id)
        .then((found) => {
          if (found) channelDiscoveryMisses.delete(id);
          else channelDiscoveryMisses.set(id, Date.now());
        })
        .catch(() => channelDiscoveryMisses.set(id, Date.now()))
        .finally(() => pendingChannels.delete(id));
    }
  }

  function ensureChannelTopic(id: string): void {
    const known = channels().find((c) => c.id === id);
    if (
      !known ||
      (known.topic && known.memberCount !== undefined) ||
      channelDetailsRequested.has(id)
    )
      return;
    channelDetailsRequested.add(id);
    fetchChannelDetails(id)
      .then((details) => {
        patchChannel(id, {
          memberCount: details.memberCount,
          name: details.name,
          private: details.private,
          topic: details.topic,
        });
      })
      .catch(() => channelDetailsRequested.delete(id));
  }

  function isChannelMember(id: string): boolean {
    return channels().some((c) => c.id === id);
  }

  const channelRosters = new Map<string, Set<string>>();
  const rosterLoads = new Map<string, Promise<Set<string> | undefined>>();

  function channelMemberIds(channelId: string): Set<string> | undefined {
    return channelRosters.get(channelId);
  }

  function ensureChannelRoster(channelId: string): Promise<Set<string> | undefined> {
    const cached = channelRosters.get(channelId);
    if (cached) return Promise.resolve(cached);
    const inFlight = rosterLoads.get(channelId);
    if (inFlight) return inFlight;
    const load = (async () => {
      try {
        const ids = new Set<string>();
        let cursor: string | undefined;
        do {
          const page = await fetchChannelMembers(channelId, "everyone", cursor);
          for (const member of page.members) ids.add(member.id);
          cursor = page.nextCursor;
        } while (cursor);
        channelRosters.set(channelId, ids);
        return ids;
      } catch (err) {
        console.error("Failed to load channel roster", err);
      } finally {
        rosterLoads.delete(channelId);
      }
    })();
    rosterLoads.set(channelId, load);
    return load;
  }

  function isChannelLeft(channelId: string): boolean {
    return !!leftChannelIds[channelId];
  }

  function isJoinPending(channelId: string): boolean {
    return !!joinPendingIds[channelId];
  }

  function isLeavePending(channelId: string): boolean {
    return !!leavePendingIds[channelId];
  }

  async function joinChannelById(channelId: string): Promise<boolean> {
    if (isJoinPending(channelId)) return false;
    setJoinPendingIds(channelId, true);
    try {
      const channel = await joinChannel(channelId);
      setExtraChannels(
        produce((list) => {
          if (!list.some((candidate) => candidate.id === channel.id)) list.push(channel);
        }),
      );
      setLeftChannelIds(channelId, false);
      deps.setActiveView({ id: channel.id, kind: "channel" });
      return true;
    } catch (err) {
      console.error("Failed to join channel", err);
      actionFeedback.flash(channelId, "Failed to join channel.", "error");
      return false;
    } finally {
      setJoinPendingIds(channelId, false);
    }
  }

  async function leaveCurrentChannel(channelId: string): Promise<boolean> {
    if (isLeavePending(channelId)) return false;
    setLeavePendingIds(channelId, true);
    try {
      await leaveChannel(channelId);
      setLeftChannelIds(channelId, true);
      if (deps.activeView()?.id === channelId) {
        const next = channels().find((c) => c.id !== channelId && !isChannelLeft(c.id));
        if (next) deps.setActiveView({ id: next.id, kind: "channel" });
      }
      return true;
    } catch (err) {
      console.error("Failed to leave channel", err);
      actionFeedback.flash(channelId, "Failed to leave channel.", "error");
      return false;
    } finally {
      setLeavePendingIds(channelId, false);
    }
  }

  async function searchBrowsableChannels(query: string) {
    const found = await fetchBrowsableChannels(query);
    setBrowsableChannels(found);
  }

  return {
    browsableChannels,
    channelById,
    channelMemberIds,
    channels,
    ensureChannelRoster,
    ensureChannelTopic,
    isChannelLeft,
    isChannelMember,
    isChannelPlacementPending,
    isChannelStarred,
    isJoinPending,
    isLeavePending,
    joinChannelById,
    leaveCurrentChannel,
    moveChannelToSection,
    patchChannel,
    searchBrowsableChannels,
    toggleChannelStar,
    ...channelSections,
  };
}
