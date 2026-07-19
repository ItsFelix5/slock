import type { Channel, DirectMessage, User } from "../../types";
import { buildUnreadMap, mapUser, type RawCounts, type RawUser } from "../mappers";
import { callSlack } from "../relay";

export interface Bootstrap {
  channels: Channel[];
  currentUser: User;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<string, number>;
  starredChannelIds: string[];
}

interface RawBootChannel {
  id: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_private?: boolean;
  name?: string;
  topic?: string | { value?: string };
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
  updated?: number;
}

interface RawBoot {
  channels?: RawBootChannel[];
  error?: string;
  ims?: RawBootIm[];
  mpims?: RawBootMpim[];
  ok?: boolean;
  self?: RawUser;
  starred?: (string | { channel?: string; id?: string })[];
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
  const [boot, counts] = await Promise.all([
    callSlack<RawBoot>("client.userBoot"),
    callSlack<RawCounts>("client.counts").catch((): RawCounts => ({ ok: false })),
  ]);
  if (!boot?.ok) throw new Error(boot?.error ?? "client.userBoot failed");

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

  const rawChannels: RawBootChannel[] = boot.channels ?? [];
  const channels: Channel[] = rawChannels
    .filter((c) => c.is_channel || c.is_group)
    .map((c) => ({
      id: c.id,
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
  const rawMpims: RawBootMpim[] = boot.mpims ?? [];
  const multiPersonDms: DirectMessage[] = rawMpims
    .filter((g) => g.is_open && Array.isArray(g.members))
    .map((g) => ({
      id: g.id,
      lastActivity:
        latestByMpim.get(g.id) || g.updated || (g.created ? g.created * 1000 : undefined),
      memberIds: (g.members ?? []).filter((id) => id !== boot.self?.id),
      unread: !!unreadMap[g.id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  if (!boot.self) throw new Error("client.userBoot response missing self");
  const currentUser = mapUser(boot.self);

  const rawStarred: (string | { channel?: string; id?: string })[] = boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred
    .map((s) => (typeof s === "string" ? s : (s?.channel ?? s?.id)))
    .filter((id): id is string => !!id);

  return { channels, currentUser, directMessages, lastReadByChannel, starredChannelIds };
}
