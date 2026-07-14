import type { Channel, DirectMessage, User } from "../types";
import { buildUnreadMap, mapUser } from "./mappers";
import { callSlack } from "./relay";

interface Bootstrap {
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
  const directMessages: DirectMessage[] = rawIms
    .filter((im) => im.is_open && im.user)
    .map((im) => ({
      id: im.id,
      lastActivity:
        latestByIm.get(im.id) || im.updated || (im.created ? im.created * 1000 : undefined),
      unread: !!unreadMap[im.id]?.unread,
      userId: im.user,
    }));

  const currentUser = mapUser(boot.self);

  const rawStarred: any[] = boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred
    .map((s) => (typeof s === "string" ? s : (s?.channel ?? s?.id)))
    .filter(Boolean);

  return { channels, currentUser, directMessages, starredChannelIds };
}
