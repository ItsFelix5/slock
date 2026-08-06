// biome-ignore-all lint/style/useNamingConvention: Raw bootstrap payloads preserve Slack's wire field names.
import type { Channel, DirectMessage, User } from "../../types";
import { buildUnreadMap, mapUser, type RawCounts, type RawUser } from "../mappers";
import { fetchInitialData } from "./initialData";

export interface Bootstrap {
  activityCounts: Record<string, number> | undefined;
  channels: Channel[];
  currentUser: User;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<string, number>;
  selfUsergroupIds: string[];
  starredChannelIds: string[];
}

interface RawBootChannel {
  created?: number;
  id: string;
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
  // Root-level array of conversation ids that are open, separate from the per-object
  // is_open on ims/mpims — this is the only place a channels-sourced mpim's open
  // state lives, since is_mpim channel entries don't carry is_open themselves.
  is_open?: string[];
  mpims?: RawBootMpim[];
  ok?: boolean;
  self?: RawUser;
  starred?: (string | { channel?: string; id?: string })[];
  subteams?: { self?: string[] };
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  // client.counts is what the real webapp uses to paint sidebar unread dots/mention
  // badges right at boot without fetching full history for every channel — without
  // it, unread state only exists after a live websocket event during the session.
  // Best-effort: if it fails, bootstrap still succeeds with "nothing unread".
  //
  // Deliberately no users.list here: a fixed-size slice of the org is never complete
  // (see store's searchUsers/userById, which already fetch users individually or via
  // live directory search), so it only added latency without actually removing any
  // of those fetches.
  const initial = await fetchInitialData();
  if (initial.error?.bootstrap) throw new Error(initial.error.bootstrap);
  const boot = initial as RawBoot;
  const counts = { ...initial.unreads, activity_v2: initial.notifications } as RawCounts;

  const unreadMap = buildUnreadMap(counts);

  // Per-conversation real Slack read cursors, from the same client.counts response
  // already fetched above for unread state — no need for a second round trip.
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
  // Some userBoot responses include MPIMs in channels as well as mpims. Keep them out of
  // channel sections and merge them into the direct-message model below.
  const channels: Channel[] = rawChannels
    .filter((c) => (c.is_channel || c.is_group) && !c.is_mpim && !c.name?.startsWith("mpdm-"))
    .map((c) => ({
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
  // Slack only flips is_open to true once a client has locally "opened" the
  // conversation, but a DM can already have real unread activity (per client.counts)
  // before that happens — e.g. someone's first message to you. Surface it either way.
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

  // Multi-person DMs (Slack's "mpim") are a separate array from 1:1 ims, with
  // group ids in the same "G..." namespace private channels use — so unlike a
  // regular DM's "D..." id, there's no shape-based way to tell an mpim apart
  // from a private channel; the app can only know one by having it loaded
  // here. Modeled as a DirectMessage with memberIds instead of a single
  // userId so the rest of the app (sidebar, unread tracking, activity
  // classification) already understands it without a parallel code path.
  const countsMpims = counts?.mpims ?? [];
  const latestByMpim = new Map(
    countsMpims
      .filter((c): c is typeof c & { id: string } => !!c.id)
      .map((c) => [c.id, parseFloat(c.latest ?? "") * 1000 || undefined]),
  );
  // Slack's userBoot sometimes only lists an mpim in `channels` (marked
  // is_mpim, with real membership) and not in `mpims` at all — merge both
  // sources by id so neither an mpim-only-in-channels nor an
  // mpim-only-in-mpims entry gets dropped. is_mpim doesn't imply open, so
  // look the channel's id up in the root is_open array rather than assuming true.
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
  // Same is_open caveat as oneToOneDms above — a group DM with real unread
  // activity needs to surface even before it's been locally "opened".
  const multiPersonDms: DirectMessage[] = [...rawMpimsById.values()]
    .filter((g) => Array.isArray(g.members) && (g.is_open || unreadMap[g.id]))
    .map((g) => ({
      id: g.id,
      lastActivity:
        latestByMpim.get(g.id) || g.updated || (g.created ? g.created * 1000 : undefined),
      memberIds: (g.members ?? []).filter((id) => id !== boot.self?.id),
      // Slack always sets a group's `name` to an auto-generated "mpdm-a--b--c-1"
      // slug built from usernames unless the conversation was explicitly renamed
      // (has_custom_mpdm_name) — only trust it in the latter case.
      name: g.properties?.has_custom_mpdm_name ? g.name : undefined,
      unread: !!unreadMap[g.id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  if (!boot.self) throw new Error("client.userBoot response missing self");
  const currentUser = mapUser(boot.self);

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
