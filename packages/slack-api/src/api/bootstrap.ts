import type { Channel, DirectMessage, User } from "../types";
import { buildUnreadMap, mapUser } from "./mappers";
import { callSlack } from "./relay";

interface Bootstrap {
  currentUser: User;
  users: User[];
  channels: Channel[];
  directMessages: DirectMessage[];
  starredChannelIds: string[];
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  // client.counts is what the real webapp uses to paint sidebar unread dots/mention
  // badges right at boot without fetching full history for every channel — without
  // it, unread state only exists after a live websocket event during the session.
  // Best-effort: if it fails, bootstrap still succeeds with "nothing unread".
  const [boot, users, counts] = await Promise.all([
    callSlack("client.userBoot"),
    callSlack("users.list", { limit: "200" }),
    callSlack("client.counts").catch(() => ({ ok: false })),
  ]);
  if (!boot?.ok) throw new Error(boot?.error ?? "client.userBoot failed");

  const unreadMap = buildUnreadMap(counts);

  const usersRaw: any[] = users?.members ?? [];
  const mappedUsers = usersRaw.filter((u) => !u.deleted).map(mapUser);

  const rawChannels: any[] = boot.channels ?? [];
  const channels: Channel[] = rawChannels
    .filter((c) => c.is_channel || c.is_group)
    .map((c) => ({
      id: c.id,
      name: c.name,
      private: !!c.is_private,
      topic: c.topic?.value || "",
      unread: !!unreadMap[c.id]?.unread,
      mentions: unreadMap[c.id]?.mentions || undefined,
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
      userId: im.user,
      unread: !!unreadMap[im.id]?.unread,
      lastActivity:
        latestByIm.get(im.id) || im.updated || (im.created ? im.created * 1000 : undefined),
    }));

  const currentUser = mapUser(boot.self);

  const rawStarred: any[] = boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred
    .map((s) => (typeof s === "string" ? s : (s?.channel ?? s?.id)))
    .filter(Boolean);

  return { currentUser, users: mappedUsers, channels, directMessages, starredChannelIds };
}
