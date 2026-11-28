import { createFlags, service } from "@slock/core/solid";
import type { View } from "@slock/plugins/conversations/client/api/types";
import { isDmId } from "@slock/plugins/dms/client/api";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import { fetchChannelDetails } from "@slock/plugins/slack/client/api";
import type { Overlay } from "@slock/resource";
import type { Channel, ChannelId, UserId, UserPrefs } from "@slock/types";
import { createMemo, createStore } from "solid-js";
import type { ChannelDecorator } from "../api";
import { joinChannel, leaveChannel } from "../requests/channels";
import { channelLookup, channelManagers, channelRosters } from "./queries";
import { createChannelSections } from "./sections";
import { createChannelStarPlacement } from "./starPlacement";

const feedback = service("feedback");

export function createChannelsStore(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: ChannelId[] } | undefined;
  decorators: () => ChannelDecorator[];
  overlayStarredIds: (change: (ids: ChannelId[]) => ChannelId[]) => Overlay;
  overlayUserPrefs: (change: (current: UserPrefs) => UserPrefs) => Overlay;
  setActiveView: (view: View) => void;
  userPrefs: () => UserPrefs | undefined;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);
  const [channelPatches, setChannelPatches] = createStore<Record<ChannelId, Partial<Channel>>>({});
  const leftChannels = createFlags<ChannelId>();

  const sections = createChannelSections({
    overlayUserPrefs: deps.overlayUserPrefs,
    userPrefs: deps.userPrefs,
  });
  const starPlacement = createChannelStarPlacement({
    changeStructure: sections.changeStructure,
    holdChannelSection: sections.holdChannelSection,
    overlayStarredIds: deps.overlayStarredIds,
    refreshSections: sections.shared.retrySections,
    sections: sections.shared.sections,
    starredIds: () => deps.bootstrap()?.starredChannelIds,
  });

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
  const canvasMemberIds = createMemo(
    () => new Set(channelLookup.values().flatMap((c) => (c?.canvasFileId ? [c.id] : []))),
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

  const seedChannel = (channel: Channel) => channelLookup.set(channel.id, channel);

  const decorated = (channel: Channel): Channel =>
    deps.decorators().reduce((current, decorate) => decorate(current), channel);

  function channelById(id: ChannelId): Channel | undefined {
    const base =
      baseChannelsById().get(id) ??
      (deps.bootstrap() ? channelLookup.peek(id) : channelLookup.read(id));
    if (!base) return;
    const patch = channelPatches[id];
    return decorated(patch ? { ...base, ...patch } : base);
  }

  async function resolveChannel(id: ChannelId): Promise<Channel | undefined> {
    const known = channelById(id);
    if (known || !deps.bootstrap()) return known;
    await channelLookup.ensure(id).catch((error) => {
      console.error("Failed to discover channel", error);
    });
    return channelById(id);
  }

  const channelTopics = defineQuery<ChannelId, true>({
    gcMs: Number.POSITIVE_INFINITY,
    load: async (id) => {
      const details = await fetchChannelDetails(id);
      patchChannel(id, {
        memberCount: details.memberCount,
        name: details.name || undefined,
        private: details.private,
        topic: details.topic,
      });
      return true;
    },
    name: "channelTopics",
    revalidates: false,
  });

  function ensureChannelTopic(id: ChannelId): Promise<boolean> {
    const known = channelById(id);
    if (
      !known ||
      (known.topic && known.memberCount !== undefined) ||
      (known.private && !isChannelMember(id))
    )
      return Promise.resolve(true);
    return channelTopics.ensure(id).catch((error) => {
      console.error("Failed to load channel details", error);
      return false;
    });
  }

  const refreshChannelTopic = (id: ChannelId) =>
    channelTopics.refresh(id).catch((error) => {
      console.error("Failed to load channel details", error);
    });

  function isChannelMember(id: ChannelId): boolean {
    return baseChannelsById().has(id) || canvasMemberIds().has(id);
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

  function updateChannelManagers(
    channelId: ChannelId,
    change: (ids: Set<UserId>) => Set<UserId>,
  ): void {
    channelManagers.modify(channelId, change);
  }

  function channelManagerIds(channelId: ChannelId): Set<UserId> | undefined {
    return channelManagers.peek(channelId);
  }

  function ensureChannelManagers(channelId: ChannelId): Promise<Set<UserId> | undefined> {
    if (isDmId(channelId, () => false)) return Promise.resolve(undefined);
    return channelManagers.ensure(channelId);
  }

  function addJoinedChannel(channel: Channel) {
    setExtraChannels((list) => {
      const idx = list.findIndex((candidate) => candidate.id === channel.id);
      if (idx === -1) list.push(channel);
      else list[idx] = channel;
    });
    leftChannels.set(channel.id, false);
  }

  const markChannelLeft = (channelId: ChannelId) => leftChannels.set(channelId, true);

  function membershipMutation<R>(
    verb: "join" | "leave",
    options: {
      onSuccess: (result: R, channelId: ChannelId) => void;
      run: (channelId: ChannelId) => Promise<R>;
    },
  ) {
    return defineMutation<ChannelId, R>({
      ...options,
      key: (channelId) => channelId,
      mode: "single",
      onError: (error, channelId) => {
        console.error(`Failed to ${verb} channel`, error);
        feedback.flash(channelId, `Failed to ${verb} channel.`, "error");
      },
    });
  }

  const joining = membershipMutation("join", {
    onSuccess: (channel: Channel) => {
      addJoinedChannel(channel);
      deps.setActiveView({ id: channel.id, kind: "channel" });
    },
    run: joinChannel,
  });
  const leaving = membershipMutation("leave", {
    onSuccess: (_reply: unknown, channelId) => markChannelLeft(channelId),
    run: leaveChannel,
  });

  return {
    addJoinedChannel,
    channelById,
    channelManagerIds,
    channelManagersState: (channelId: () => ChannelId | undefined) =>
      channelManagers.state(channelId),
    channelRosterIds,
    channels,
    ensureChannelManagers,
    ensureChannelRoster,
    ensureChannelTopic,
    invalidateChannelRoster,
    isChannelLeft: leftChannels.has,
    isChannelMember,
    isJoinPending: (channelId: ChannelId) => joining.pending(channelId),
    isLeavePending: (channelId: ChannelId) => leaving.pending(channelId),
    joinChannelById: (channelId: ChannelId) => joining.run(channelId),
    leaveCurrentChannel: (channelId: ChannelId) => leaving.run(channelId),
    markChannelLeft,
    patchChannel,
    refreshChannelTopic,
    resolveChannel,
    seedChannel,
    updateChannelManagers,
    ...sections.shared,
    ...starPlacement,
  };
}
