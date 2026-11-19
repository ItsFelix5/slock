import { service } from "@slock/core/solid";
import type { BrowsableChannel, Channel, ChannelId, UserId, UserPrefs } from "@slock/types";
import { createEffect, createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js";
import type { View } from "../../../conversations/client/api/types";
import { isDmId } from "../../../dms/client/api";
import {
  fetchBrowsableChannels,
  fetchChannel,
  fetchChannelDetails,
  joinChannel,
  leaveChannel,
} from "../../../slack/client/api";
import type { ChannelDecorator } from "../api";
import { channelManagers, channelRosters } from "./queries";
import { createFlags } from "./flags";
import { createChannelSections } from "./sections";
import { createChannelStarPlacement } from "./starPlacement";

const env = service("env");

const feedback = service("feedback");


export function createChannelsStore(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: ChannelId[] } | undefined;
  activeView: () => View | null;
  decorators: () => ChannelDecorator[];
  setActiveView: (view: View) => void;
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) => void;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);

  const [discoveredChannels, setDiscoveredChannels] = createStore<Record<ChannelId, Channel>>({});
  const pendingChannels = new Map<ChannelId, Promise<unknown>>();
  const channelDiscoveryMisses = new Map<ChannelId, number>();
  const channelDiscoveryRetryMs = 30_000;
  const channelDetailsRequested = new Map<ChannelId, Promise<boolean>>();

  const [channelPatches, setChannelPatches] = createStore<Record<ChannelId, Partial<Channel>>>({});
  const leftChannels = createFlags<ChannelId>();
  const joinPending = createFlags<ChannelId>();
  const leavePending = createFlags<ChannelId>();
  let starredSeeded = false;
  const [browsableChannels, setBrowsableChannels] = createSignal<BrowsableChannel[]>([]);

  const channelSections = createChannelSections({
    mutateUserPrefs: deps.mutateUserPrefs,
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

  createEffect(
    () => deps.bootstrap()?.starredChannelIds,
    (starredIds) => {
      if (!starredIds || starredSeeded) return;
      starredSeeded = true;
      for (const id of starredIds) setStarredChannelIds(id, true);
    },
  );

  const baseChannelsById = createMemo(() => {
    const base = deps.bootstrap()?.channels ?? [];
    const baseIds = new Set(base.map((c) => c.id));
    const extra = extraChannels.filter((c) => !baseIds.has(c.id));
    return new Map([...base, ...extra].map((c) => [c.id, c]));
  });
  const channels = createMemo<Channel[]>(() =>
    [...baseChannelsById().values()]
      .filter((c) => !c.canvasFileId)
      .map((c) => (channelPatches[c.id] ? { ...c, ...channelPatches[c.id] } : c)),
  );

  function patchChannel(id: ChannelId, patch: Partial<Channel>) {
    const known = baseChannelsById().get(id);
    const allowed = known?.canvasFileId ? { ...patch, name: undefined } : patch;
    const defined = Object.fromEntries(
      Object.entries(allowed).filter(([, value]) => value !== undefined),
    );
    setChannelPatches((draft) => {
      draft[id] = { ...draft[id], ...defined };
    });
  }

  async function discoverChannel(id: ChannelId): Promise<boolean> {
    try {
      const channel = await fetchChannel(id);
      if (!channel) return false;
      setDiscoveredChannels((draft) => {
        draft[channel.id] = channel;
      });
      return true;
    } catch (err) {
      console.error("Failed to discover channel", err);
      return false;
    }
  }

  const decorated = (channel: Channel): Channel =>
    deps.decorators().reduce((current, decorate) => decorate(current), channel);

  function channelById(id: ChannelId): Channel | undefined {
    const base = baseChannelsById().get(id) ?? discoveredChannels[id];
    const patch = channelPatches[id];
    const known = base && patch ? { ...base, ...patch } : base;
    if (known) return decorated(known);

    if (!deps.bootstrap()) return;
    const missedAt = channelDiscoveryMisses.get(id);
    if (missedAt && env.now() - missedAt < channelDiscoveryRetryMs) return;
    if (!pendingChannels.has(id)) {
      pendingChannels.set(
        id,
        discoverChannel(id)
          .then((found) => {
            if (found) channelDiscoveryMisses.delete(id);
            else channelDiscoveryMisses.set(id, env.now());
          })
          .finally(() => pendingChannels.delete(id)),
      );
    }
  }

  async function resolveChannel(id: ChannelId): Promise<Channel | undefined> {
    const known = channelById(id);
    if (known) return known;
    await pendingChannels.get(id);
    return channelById(id);
  }

  function ensureChannelTopic(id: ChannelId): Promise<boolean> {
    const known = channelById(id);
    if (
      !known ||
      (known.topic && known.memberCount !== undefined) ||
      (known.private && !isChannelMember(id))
    )
      return Promise.resolve(true);
    const inflight = channelDetailsRequested.get(id);
    if (inflight) return inflight;
    const request = fetchChannelDetails(id)
      .then((details) => {
        patchChannel(id, {
          memberCount: details.memberCount,
          name: details.name,
          private: details.private,
          topic: details.topic,
        });
        return true;
      })
      .catch((err) => {
        console.error("Failed to load channel details", err);
        channelDetailsRequested.delete(id);
        return false;
      });
    channelDetailsRequested.set(id, request);
    return request;
  }

  function isChannelMember(id: ChannelId): boolean {
    return baseChannelsById().has(id) || !!discoveredChannels[id]?.canvasFileId;
  }

  function channelRosterIds(channelId: ChannelId): Set<UserId> | undefined {
    return channelRosters.peek(channelId);
  }

  function ensureChannelRoster(channelId: ChannelId): Promise<Set<UserId> | undefined> {
    if (isDmId(channelId, () => false)) return Promise.resolve(undefined);
    const channel = channelById(channelId);
    if (channel?.private && !isChannelMember(channelId)) return Promise.resolve(new Set());
    return channelRosters.ensure(channelId);
  }

  function invalidateChannelRoster(channelId: ChannelId): void {
    channelRosters.invalidate(channelId);
  }

  function channelManagerIds(channelId: ChannelId): Set<UserId> | undefined {
    return channelManagers.peek(channelId);
  }

  function ensureChannelManagers(channelId: ChannelId): Promise<Set<UserId> | undefined> {
    if (isDmId(channelId, () => false)) return Promise.resolve(undefined);
    return channelManagers.ensure(channelId);
  }

  function isChannelLeft(channelId: ChannelId): boolean {
    return leftChannels.has(channelId);
  }

  function isJoinPending(channelId: ChannelId): boolean {
    return joinPending.has(channelId);
  }

  function isLeavePending(channelId: ChannelId): boolean {
    return leavePending.has(channelId);
  }

  function addJoinedChannel(channel: Channel) {
    setExtraChannels((list) => {
      const idx = list.findIndex((candidate) => candidate.id === channel.id);
      if (idx === -1) list.push(channel);
      else list[idx] = channel;
    });
    leftChannels.set(channel.id, false);
  }

  function markChannelLeft(channelId: ChannelId) {
    if (leftChannels.has(channelId)) return;
    leftChannels.set(channelId, true);
  }

  async function joinChannelById(channelId: ChannelId): Promise<boolean> {
    if (isJoinPending(channelId)) return false;
    joinPending.set(channelId, true);
    try {
      const channel = await joinChannel(channelId);
      addJoinedChannel(channel);
      deps.setActiveView({ id: channel.id, kind: "channel" });
      return true;
    } catch (err) {
      console.error("Failed to join channel", err);
      feedback.flash(channelId, "Failed to join channel.", "error");
      return false;
    } finally {
      joinPending.set(channelId, false);
    }
  }

  async function leaveCurrentChannel(channelId: ChannelId): Promise<boolean> {
    if (isLeavePending(channelId)) return false;
    leavePending.set(channelId, true);
    try {
      await leaveChannel(channelId);
      markChannelLeft(channelId);
      return true;
    } catch (err) {
      console.error("Failed to leave channel", err);
      feedback.flash(channelId, "Failed to leave channel.", "error");
      return false;
    } finally {
      leavePending.set(channelId, false);
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
    resolveChannel,
    searchBrowsableChannels,
    setStarredChannelIds,
    toggleChannelStar,
    ...channelSections,
  };
}
