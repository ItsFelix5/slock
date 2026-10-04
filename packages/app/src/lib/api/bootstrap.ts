import type { Bootstrap, Channel, DirectMessage, RawChannel, RawCounts, User } from "@slock/types";
import { ApiError, buildUnreadMap, mapUser } from "@slock/types";
import { fetchInitialData } from "./initialData";

export async function fetchBootstrap(): Promise<Bootstrap> {
  const initial = await fetchInitialData();
  if (initial.error?.bootstrap) {
    throw new ApiError(initial.error.bootstrap, initial.retry_after?.bootstrap);
  }
  const boot = initial;
  const counts: RawCounts = {
    ...initial.unreads,
    activity_v2: initial.notifications,
  };

  const unreadMap = buildUnreadMap(counts);

  const lastReadByChannel: Record<string, number> = {};
  for (const list of [counts?.channels, counts?.ims, counts?.mpims]) {
    for (const c of list ?? []) {
      const ts = parseFloat(c.last_read ?? "");
      if (ts && c.id) lastReadByChannel[c.id] = ts * 1000;
    }
  }

  const latestByChannel = new Map(
    (counts?.channels ?? [])
      .filter((c): c is typeof c & { id: string } => !!c.id)
      .map((c) => [c.id, parseFloat(c.latest ?? "") * 1000 || undefined]),
  );

  const rawChannels = boot.channels ?? [];

  const channels: Channel[] = rawChannels
    .filter((c) => (c.is_channel || c.is_group) && !c.is_mpim && !c.name?.startsWith("mpdm-"))
    .map((c) => ({
      archived: !!c.is_archived,
      id: c.id,
      lastActivity: latestByChannel.get(c.id),
      mentions: unreadMap[c.id]?.mentions || undefined,
      name: c.name ?? c.id,
      private: !!c.is_private,
      topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
      unread: !!unreadMap[c.id]?.unread,
    }));

  const countsIms = counts?.ims ?? [];
  const latestByIm = new Map(
    countsIms
      .filter((c): c is typeof c & { id: string } => !!c.id)
      .map((c) => [c.id, parseFloat(c.latest ?? "") * 1000 || undefined]),
  );

  const oneToOneDms: DirectMessage[] = (boot.ims ?? [])
    .filter((im) => im.user && (im.is_open || unreadMap[im.id]))
    .map((im) => ({
      id: im.id,
      lastActivity:
        latestByIm.get(im.id) || im.updated || (im.created ? im.created * 1000 : undefined),
      mentions: unreadMap[im.id]?.mentions || undefined,
      unread: !!unreadMap[im.id]?.unread,
      userId: im.user,
    }));

  const countsMpims = counts?.mpims ?? [];
  const latestByMpim = new Map(
    countsMpims
      .filter((c): c is typeof c & { id: string } => !!c.id)
      .map((c) => [c.id, parseFloat(c.latest ?? "") * 1000 || undefined]),
  );

  const openIds = new Set(boot.is_open ?? []);
  const rawMpimsById = new Map<string, RawChannel>(
    (boot.mpims ?? []).map((mpim) => [mpim.id, mpim]),
  );
  for (const channel of rawChannels) {
    if (!channel.is_mpim) continue;
    rawMpimsById.set(channel.id, { ...channel, is_open: openIds.has(channel.id) });
  }

  const multiPersonDms: DirectMessage[] = [...rawMpimsById.values()]
    .filter((g) => Array.isArray(g.members) && (g.is_open || unreadMap[g.id]))
    .map((g) => ({
      id: g.id,
      lastActivity:
        latestByMpim.get(g.id) || g.updated || (g.created ? g.created * 1000 : undefined),
      memberIds: (g.members ?? []).filter((id) => id !== boot.self?.id),
      mentions: unreadMap[g.id]?.mentions || undefined,
      name: g.properties?.has_custom_mpdm_name ? g.name : undefined,
      unread: !!unreadMap[g.id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  if (!boot.self) throw new Error("client.userBoot response missing self");

  const currentUser: User = {
    ...mapUser(boot.self),
    presence: boot.self.presence === "away" ? "away" : "active",
  };

  const starredChannelIds: string[] = (boot.starred ?? [])
    .map((s) => (typeof s === "string" ? s : (s.channel ?? s.id)))
    .filter((id): id is string => !!id);

  const selfUsergroupIds = boot.subteams?.self ?? [];
  const allUsergroupIds = boot.subteams?.all ?? [];

  return {
    activityCounts: counts.activity_v2,
    allUsergroupIds,
    channels,
    currentUser,
    directMessages,
    lastReadByChannel,
    selfUsergroupIds,
    starredChannelIds,
  };
}
