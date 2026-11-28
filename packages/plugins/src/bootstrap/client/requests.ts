import { fetchCounts } from "@slock/plugins/slack/client/api/counts";
import {
  completePending,
  fetchInitialData,
  isPending,
} from "@slock/plugins/slack/client/api/initialData";
import { fetchPrefsPayload, mapUserPrefs } from "@slock/plugins/slack/client/api/preferences";
import {
  buildUnreadMap,
  ifPresent,
  mapGroupDm,
  mapUser,
  parseChannelId,
  parseUserId,
  slackErrorOf,
} from "@slock/slack";
import type {
  Bootstrap,
  Channel,
  ChannelId,
  DirectMessage,
  RawChannel,
  RawCountGroup,
  RawCounts,
  User,
  UserPrefs,
} from "@slock/types";

export async function fetchBootstrap(onCountsLoaded: () => void): Promise<Bootstrap> {
  const initial = await fetchInitialData();
  if (isPending(initial, "counts")) void completePending("counts", loadCounts).then(onCountsLoaded);
  if (initial.error?.bootstrap) {
    throw slackErrorOf({
      code: initial.error.bootstrap,
      fallback: "bootstrap failed",
      retryAfter: initial.retry_after?.bootstrap,
    });
  }
  const boot = initial;
  const counts: RawCounts = {
    ...initial.unreads,
    activity_v2: initial.notifications,
  };

  const unreadMap = buildUnreadMap(counts);

  const lastReadByChannel: Record<ChannelId, number> = {};
  for (const list of [counts.channels, counts.ims, counts.mpims]) {
    for (const c of list ?? []) {
      const ts = parseFloat(c.last_read ?? "");
      if (ts && c.id) lastReadByChannel[parseChannelId(c.id)] = ts * 1000;
    }
  }

  const latestByChannel = latestById(counts.channels);

  const rawChannels = boot.channels ?? [];

  const channels: Channel[] = rawChannels
    .filter((c) => (c.is_channel || c.is_group) && !c.is_mpim && !c.name?.startsWith("mpdm-"))
    .map((c) => {
      const id = parseChannelId(c.id);
      return {
        archived: !!c.is_archived,
        id,
        lastActivity: latestByChannel.get(id),
        mentions: unreadMap[id]?.mentions || undefined,
        name: c.name ?? c.id,
        private: !!c.is_private,
        topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
        unread: !!unreadMap[id]?.unread,
      };
    });

  const latestByIm = latestById(counts.ims);

  const oneToOneDms: DirectMessage[] = (boot.ims ?? [])
    .map((im) => ({ id: parseChannelId(im.id), im }))
    .filter(({ id, im }) => im.user && (im.is_open || unreadMap[id]))
    .map(({ id, im }) => ({
      id,
      lastActivity:
        latestByIm.get(id) || im.updated || (im.created ? im.created * 1000 : undefined),
      mentions: unreadMap[id]?.mentions || undefined,
      unread: !!unreadMap[id]?.unread,
      userId: ifPresent(parseUserId, im.user),
    }));

  const latestByMpim = latestById(counts.mpims);

  const openIds = new Set(boot.is_open ?? []);
  const rawMpimsById = new Map<ChannelId, RawChannel>(
    (boot.mpims ?? []).map((mpim) => [parseChannelId(mpim.id), mpim]),
  );
  for (const channel of rawChannels) {
    if (!channel.is_mpim) continue;
    rawMpimsById.set(parseChannelId(channel.id), {
      ...channel,
      is_open: openIds.has(channel.id),
    });
  }

  const multiPersonDms: DirectMessage[] = [...rawMpimsById]
    .filter(([id, g]) => Array.isArray(g.members) && (g.is_open || unreadMap[id]))
    .map(([id, g]) => ({
      ...mapGroupDm(g, boot.self?.id),
      lastActivity: latestByMpim.get(id) || g.updated || (g.created ? g.created * 1000 : undefined),
      mentions: unreadMap[id]?.mentions || undefined,
      unread: !!unreadMap[id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  if (!boot.self) throw new Error("client.userBoot response missing self");

  const currentUser: User = {
    ...mapUser(boot.self),
    presence: boot.self.presence === "away" ? "away" : "active",
  };

  const starredChannelIds = (boot.starred ?? []).flatMap((s) => {
    const id = typeof s === "string" ? s : (s.channel ?? s.id);
    return id ? [parseChannelId(id)] : [];
  });

  const selfUsergroupIds = boot.subteams?.self ?? [];
  const allUsergroupIds = boot.subteams?.all ?? [];

  return {
    activityCounts: counts.activity_v2,
    allUsergroupIds,
    channels,
    countsLoaded: !isPending(initial, "counts"),
    currentUser,
    directMessages,
    lastReadByChannel,
    selfUsergroupIds,
    starredChannelIds,
  };
}

async function loadCounts() {
  const counts = await fetchCounts().catch(() => undefined);
  return { notifications: counts?.notifications, unreads: counts?.unreads };
}

function latestById(groups: RawCountGroup[] | undefined) {
  return new Map(
    (groups ?? []).flatMap((group) =>
      group.id
        ? [[parseChannelId(group.id), parseFloat(group.latest ?? "") * 1000 || undefined] as const]
        : [],
    ),
  );
}

export async function fetchUserPrefs(signal: AbortSignal): Promise<UserPrefs> {
  return mapUserPrefs(await fetchPrefsPayload(signal));
}
