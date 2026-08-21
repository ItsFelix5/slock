import type { Bootstrap, Channel, DirectMessage, User } from "@slock/types";
import { buildUnreadMap, mapUser, type RawCounts, type RawUser } from "@slock/types";
import { fetchInitialData } from "./initialData";

interface RawBootChannel {
  created?: number;
  id: string;
  is_archived?: boolean;
  is_channel?: boolean;
  is_group?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  members?: string[];
  name?: string;
  properties?: { has_custom_mpdm_name?: boolean };
  topic?: string | { value?: string };
  updated?: number;
}

interface RawBootIm {
  created?: number;
  id: string;
  is_open?: boolean;
  updated?: number;
  user?: string;
}

interface RawBootMpim {
  created?: number;
  id: string;
  is_open?: boolean;
  members?: string[];
  name?: string;
  properties?: { has_custom_mpdm_name?: boolean };
  updated?: number;
}

interface RawBoot {
  channels?: RawBootChannel[];
  error?: string;
  ims?: RawBootIm[];

  is_open?: string[];
  mpims?: RawBootMpim[];
  ok?: boolean;
  self?: RawUser;
  starred?: (string | { channel?: string; id?: string })[];
  subteams?: { self?: string[] };
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const initial = await fetchInitialData();
  if (initial.error?.bootstrap) throw new Error(initial.error.bootstrap);
  const boot = initial as RawBoot;
  const counts = {
    ...initial.unreads,
    activity_v2: initial.notifications,
  } as RawCounts;

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

  const rawChannels: RawBootChannel[] = boot.channels ?? [];

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

  const rawIms: RawBootIm[] = boot.ims ?? [];

  const oneToOneDms: DirectMessage[] = rawIms
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
  const rawMpimsById = new Map<string, RawBootMpim>(
    (boot.mpims ?? []).map((mpim) => [mpim.id, mpim]),
  );
  for (const channel of rawChannels) {
    if (!channel.is_mpim) continue;
    rawMpimsById.set(channel.id, {
      created: channel.created,
      id: channel.id,
      is_open: openIds.has(channel.id),
      members: channel.members,
      name: channel.name,
      properties: channel.properties,
      updated: channel.updated,
    });
  }

  const multiPersonDms: DirectMessage[] = [...rawMpimsById.values()]
    .filter((g) => Array.isArray(g.members) && (g.is_open || unreadMap[g.id]))
    .map((g) => ({
      id: g.id,
      lastActivity:
        latestByMpim.get(g.id) || g.updated || (g.created ? g.created * 1000 : undefined),
      memberIds: (g.members ?? []).filter((id) => id !== boot.self?.id),

      name: g.properties?.has_custom_mpdm_name ? g.name : undefined,
      unread: !!unreadMap[g.id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  if (!boot.self) throw new Error("client.userBoot response missing self");

  const currentUser: User = {
    ...mapUser(boot.self),
    presence: boot.self.presence === "away" ? "away" : "active",
  };

  const rawStarred: (string | { channel?: string; id?: string })[] = boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred
    .map((s) => (typeof s === "string" ? s : (s?.channel ?? s?.id)))
    .filter((id): id is string => !!id);

  const selfUsergroupIds = boot.subteams?.self ?? [];

  return {
    activityCounts: counts.activity_v2,
    channels,
    currentUser,
    directMessages,
    lastReadByChannel,
    selfUsergroupIds,
    starredChannelIds,
  };
}
