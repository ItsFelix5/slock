import type { User, Channel, DirectMessage, Message } from './types';

interface Bootstrap {
  currentUser: User;
  users: User[];
  channels: Channel[];
  directMessages: DirectMessage[];
}

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : '#616061';
}

function initialsOf(name: string) {
  return name.slice(0, 1).toUpperCase() || '?';
}

function mapUser(raw: any): User {
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  return {
    id: raw.id,
    name,
    avatarColor: colorFromHex(raw.color),
    avatarUrl: raw.profile?.image_48,
    initials: initialsOf(name),
    presence: raw.presence === 'away' ? 'away' : 'active',
  };
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const res = await fetch('/api/bootstrap');
  const data = await res.json();
  if (!data.boot?.ok) {
    throw new Error(data.boot?.error ?? 'client.userBoot failed');
  }

  const usersRaw: any[] = data.users?.members ?? [];
  const users = usersRaw.filter((u) => !u.deleted).map(mapUser);

  const rawChannels: any[] = data.boot.channels ?? [];
  const channels: Channel[] = rawChannels
    .filter((c) => c.is_channel || c.is_group)
    .map((c) => ({
      id: c.id,
      name: c.name,
      private: !!c.is_private,
      topic: c.purpose?.value || c.topic?.value || '',
      unread: false,
    }));

  const rawIms: any[] = data.boot.ims ?? [];
  const directMessages: DirectMessage[] = rawIms
    .filter((im) => im.is_open && im.user)
    .map((im) => ({ id: im.id, userId: im.user, unread: false }));

  const currentUser = mapUser(data.boot.self);

  return { currentUser, users, channels, directMessages };
}

function formatTime(ts: string) {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDay(ts: string) {
  const date = new Date(parseFloat(ts) * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function mapMessage(m: any): Message {
  return {
    id: m.ts,
    ts: m.ts,
    userId: m.user,
    text: m.text,
    blocks: m.blocks,
    time: formatTime(m.ts),
    day: formatDay(m.ts),
    replyCount: m.reply_count,
    replyUsers: m.reply_users,
    reactions: m.reactions,
  };
}

export async function fetchHistory(channelId: string): Promise<Message[]> {
  const res = await fetch(`/api/history?channel=${encodeURIComponent(channelId)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.history failed');
  const messages: any[] = data.messages ?? [];
  return messages
    .filter((m) => m.type === 'message' && !m.subtype)
    .map(mapMessage)
    .reverse();
}

export async function fetchReplies(channelId: string, threadTs: string): Promise<Message[]> {
  const res = await fetch(
    `/api/replies?channel=${encodeURIComponent(channelId)}&ts=${encodeURIComponent(threadTs)}`,
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.replies failed');
  const messages: any[] = data.messages ?? [];
  return messages.filter((m) => m.type === 'message').map(mapMessage);
}

export async function fetchUser(id: string): Promise<User | null> {
  const res = await fetch(`/api/user?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!data.ok) return null;
  return mapUser(data.user);
}

export async function postMessage(channelId: string, text: string, threadTs?: string) {
  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text, thread_ts: threadTs }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'chat.postMessage failed');
  return data;
}

export async function editMessage(channelId: string, ts: string, text: string) {
  const res = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ts, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'chat.update failed');
  return data;
}

export async function deleteMessage(channelId: string, ts: string) {
  const res = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ts }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'chat.delete failed');
  return data;
}

export async function toggleReaction(channelId: string, ts: string, name: string, remove: boolean) {
  const res = await fetch('/api/react', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, timestamp: ts, name, remove }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'reactions failed');
  return data;
}

export async function toggleSaved(channelId: string, ts: string, remove: boolean) {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ts, remove }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'saved.add/remove failed');
  return data;
}
