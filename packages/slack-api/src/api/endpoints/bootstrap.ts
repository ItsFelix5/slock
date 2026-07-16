import type { Channel, DirectMessage, User } from "../../types";
import { buildUnreadMap, mapUser } from "../mappers";
import { callSlack } from "../relay";

export interface Bootstrap {
  channels: Channel[];
  currentUser: User;
  directMessages: DirectMessage[];
  starredChannelIds: string[];
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
    callSlack("client.userBoot"),
    callSlack("client.counts").catch(() => ({ ok: false })),
  ]);
  if (!boot?.ok) throw new Error(boot?.error ?? "client.userBoot failed");

  const unreadMap = buildUnreadMap(counts);

  const rawChannels: any[] = boot.channels ?? [];
  const channels: Channel[] = rawChannels
    .filter((c) => c.is_channel || c.is_group)
    .map((c) => ({
      id: c.id,
      mentions: unreadMap[c.id]?.mentions || undefined,
      name: c.name,
      private: !!c.is_private,
      topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
      unread: !!unreadMap[c.id]?.unread,
    }));

  const countsIms: any[] = counts?.ims ?? [];
  const latestByIm = new Map(
    countsIms.map((c) => [c.id, parseFloat(c.latest) * 1000 || undefined]),
  );

  const rawIms: any[] = boot.ims ?? [];
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
  const countsMpims: any[] = counts?.mpims ?? [];
  const latestByMpim = new Map(
    countsMpims.map((c) => [c.id, parseFloat(c.latest) * 1000 || undefined]),
  );
  const rawMpims: any[] = boot.mpims ?? [];
  const multiPersonDms: DirectMessage[] = rawMpims
    .filter((g) => g.is_open && Array.isArray(g.members))
    .map((g) => ({
      id: g.id,
      lastActivity:
        latestByMpim.get(g.id) || g.updated || (g.created ? g.created * 1000 : undefined),
      memberIds: (g.members as string[]).filter((id) => id !== boot.self?.id),
      unread: !!unreadMap[g.id]?.unread,
    }));

  const directMessages: DirectMessage[] = [...oneToOneDms, ...multiPersonDms];

  const currentUser = mapUser(boot.self);

  const rawStarred: any[] = boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred
    .map((s) => (typeof s === "string" ? s : (s?.channel ?? s?.id)))
    .filter(Boolean);

  return { channels, currentUser, directMessages, starredChannelIds };
}
