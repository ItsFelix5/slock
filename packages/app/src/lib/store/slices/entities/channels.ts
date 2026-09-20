import { createReactiveQueryCache } from "../../../reactiveQueryCache";
import { queryOptions } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { BrowsableChannel, Channel, UserPrefs } from "../../../api";

import {
  fetchBrowsableChannels,
  fetchChannel,
  fetchChannelDetails,
  fetchChannelManagerIds,
  fetchChannelMembers,
  joinChannel,
  leaveChannel,
} from "../../../api";
import { actionFeedback } from "../../../feedback";
import { queryClient } from "../../../queryClient";
import type { Nav, View } from "../types";
import { createChannelSections } from "./channelSections";
import { createChannelStarPlacement } from "./channelStarPlacement";
import { isDmId } from "./dms";

export function channelRosterQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["channelRosters", channelId],
    queryFn: async () => {
      const ids = new Set<string>();
      for (const filter of ["everyone", "apps"] as const) {
        let cursor: string | undefined;
        do {
          const page = await fetchChannelMembers(channelId, filter, cursor);
          for (const member of page.members) ids.add(member.id);
          cursor = page.nextCursor;
        } while (cursor);
      }
      return ids;
    },
  });
}

export function channelManagerQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["channelManagers", channelId],
    queryFn: async () => new Set(await fetchChannelManagerIds(channelId)),
  });
}

export function createChannelsSlice(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: string[] } | undefined;
  activeView: () => View | null;
  nav: () => Nav;
  setActiveView: (view: View) => void;
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) => void;
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

  const baseChannelsById = createMemo(() => {
    const base = deps.bootstrap()?.channels ?? [];
    const extra = extraChannels.filter((c) => !base.some((b) => b.id === c.id));
    return new Map([...base, ...extra].map((c) => [c.id, c]));
  });
  const channels = createMemo<Channel[]>(() =>
    [...baseChannelsById().values()].map((c) =>
      channelPatches[c.id] ? { ...c, ...channelPatches[c.id] } : c,
    ),
  );

  function patchChannel(id: string, patch: Partial<Channel>) {
    const known: Partial<Channel> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) known[key] = value;
    }
    setChannelPatches(id, { ...channelPatches[id], ...known });
  }

  async function discoverChannel(id: string): Promise<boolean> {
    const channel = await fetchChannel(id);
    if (!channel) return false;
    setDiscoveredChannels(produce((list) => list.push(channel)));
    return true;
  }

  function channelById(id: string): Channel | undefined {
    const base = baseChannelsById().get(id) ?? discoveredChannels.find((c) => c.id === id);
    const patch = channelPatches[id];
    const known = base && patch ? { ...base, ...patch } : base;
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
    const known = channelById(id);
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
    return baseChannelsById().has(id);
  }

  const channelRosters = createReactiveQueryCache<Set<string>>(
    queryClient,
    "channelRosters",
    channelRosterQueryOptions,
  );

  function channelRosterIds(channelId: string): Set<string> | undefined {
    return channelRosters.entry(channelId);
  }

  function ensureChannelRoster(channelId: string): Promise<Set<string> | undefined> {
    if (isDmId(channelId, () => false)) return Promise.resolve(undefined);
    return queryClient.ensureQueryData(channelRosterQueryOptions(channelId));
  }

  function invalidateChannelRoster(channelId: string): void {
    channelRosters.invalidate(channelId);
  }

  const channelManagers = createReactiveQueryCache<Set<string>>(
    queryClient,
    "channelManagers",
    channelManagerQueryOptions,
  );

  function channelManagerIds(channelId: string): Set<string> | undefined {
    return channelManagers.entry(channelId);
  }

  function ensureChannelManagers(channelId: string): Promise<Set<string> | undefined> {
    if (isDmId(channelId, () => false)) return Promise.resolve(undefined);
    return queryClient.ensureQueryData(channelManagerQueryOptions(channelId));
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

  function addJoinedChannel(channel: Channel) {
    setExtraChannels(
      produce((list) => {
        const idx = list.findIndex((candidate) => candidate.id === channel.id);
        if (idx === -1) list.push(channel);
        else list[idx] = channel;
      }),
    );
    setLeftChannelIds(channel.id, false);
  }

  function markChannelLeft(channelId: string) {
    if (leftChannelIds[channelId]) return;
    setLeftChannelIds(channelId, true);
    if (deps.activeView()?.id === channelId) {
      const next = channels().find((c) => c.id !== channelId && !isChannelLeft(c.id));
      if (next) deps.setActiveView({ id: next.id, kind: "channel" });
    }
  }

  async function joinChannelById(channelId: string): Promise<boolean> {
    if (isJoinPending(channelId)) return false;
    setJoinPendingIds(channelId, true);
    try {
      const channel = await joinChannel(channelId);
      addJoinedChannel(channel);
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
      markChannelLeft(channelId);
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
    addJoinedChannel,
    browsableChannels,
    channelById,
    channelManagerIds,
    channelRosterIds,
    channels,
    ensureChannelManagers,
    ensureChannelRoster,
    ensureChannelTopic,
    invalidateChannelRoster,
    isChannelLeft,
    isChannelMember,
    isChannelPlacementPending,
    isChannelStarred,
    isJoinPending,
    isLeavePending,
    joinChannelById,
    leaveCurrentChannel,
    markChannelLeft,
    moveChannelToSection,
    patchChannel,
    searchBrowsableChannels,
    setStarredChannelIds,
    toggleChannelStar,
    ...channelSections,
  };
}
