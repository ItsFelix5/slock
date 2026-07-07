import type {
  User,
  Channel,
  DirectMessage,
  Message,
  MessageKind,
  SlackFile,
  Attachment,
  ChannelSection,
  ActivityItem,
  SavedItem,
  BrowsableChannel,
  ProfileFieldDef,
} from './types';

interface Bootstrap {
  currentUser: User;
  users: User[];
  channels: Channel[];
  directMessages: DirectMessage[];
  starredChannelIds: string[];
}

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : '#616061';
}

function initialsOf(name: string) {
  return name.slice(0, 1).toUpperCase() || '?';
}

function tzLabelFromOffset(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const hours = seconds / 3600;
  const sign = hours >= 0 ? '+' : '-';
  const abs = Math.abs(hours);
  const whole = Math.floor(abs);
  const minutes = Math.round((abs - whole) * 60);
  return `UTC${sign}${whole}${minutes ? ':' + String(minutes).padStart(2, '0') : ''}`;
}

// The self object in client.userBoot (unlike regular users.list members) carries no
// profile.image_* URLs at all — just an avatar_hash — so the current user's own avatar
// has to be built from Slack's CDN URL convention instead of read off the profile directly.
function avatarUrlFromHash(raw: any): string | undefined {
  const hash = raw.profile?.avatar_hash;
  const team = raw.profile?.team ?? raw.team_id;
  if (!hash || !team) return undefined;
  return `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192`;
}

function mapUser(raw: any): User {
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  const rawFields = raw.profile?.fields ?? {};
  const customFields = Object.keys(rawFields)
    .map((id) => ({ id, value: rawFields[id]?.value ?? '', alt: rawFields[id]?.alt || undefined }))
    .filter((f) => f.value);
  return {
    id: raw.id,
    name,
    avatarColor: colorFromHex(raw.color),
    avatarUrl: raw.profile?.image_192 || raw.profile?.image_72 || raw.profile?.image_48 || avatarUrlFromHash(raw),
    initials: initialsOf(name),
    presence: raw.presence === 'away' ? 'away' : 'active',
    title: raw.profile?.title || undefined,
    pronouns: raw.profile?.pronouns || undefined,
    statusText: raw.profile?.status_text || undefined,
    statusEmoji: raw.profile?.status_emoji || undefined,
    // Slackbot is a built-in pseudo-user, not a real bot-token integration, so
    // Slack's API never sets is_bot for it — flag it by id instead.
    isBot: !!raw.is_bot || raw.id === 'USLACKBOT',
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
    email: raw.profile?.email || undefined,
    phone: raw.profile?.phone || undefined,
    customFields: customFields.length ? customFields : undefined,
  };
}

// client.counts is what the real webapp uses to paint unread dots/mention badges at
// boot without fetching full history for every channel. Field names below are our
// best understanding of that (undocumented) shape; anything that doesn't match just
// falls through to "not unread" for that entry rather than throwing, since this is
// read-only enhancement, not something bootstrap should ever fail over.
function buildUnreadMap(counts: any): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  if (!counts?.ok) return map;
  const groups: any[] = [...(counts.channels ?? []), ...(counts.mpims ?? []), ...(counts.ims ?? [])];
  for (const g of groups) {
    if (!g?.id) continue;
    const mentions = Number(g.mention_count ?? g.mention_count_display ?? 0) || 0;
    const unreadCount = Number(g.unread_count_display ?? g.unread_count ?? 0) || 0;
    const unread = !!(g.has_unreads ?? g.is_unread ?? (unreadCount > 0 || mentions > 0));
    map[g.id] = { unread, mentions };
  }
  return map;
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const res = await fetch('/api/bootstrap');
  const data = await res.json();
  if (!data.boot?.ok) {
    throw new Error(data.boot?.error ?? 'client.userBoot failed');
  }

  const unreadMap = buildUnreadMap(data.counts);

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
      unread: !!unreadMap[c.id]?.unread,
      mentions: unreadMap[c.id]?.mentions || undefined,
    }));

  const countsIms: any[] = data.counts?.ims ?? [];
  const latestByIm = new Map(countsIms.map((c) => [c.id, parseFloat(c.latest) * 1000 || undefined]));

  const rawIms: any[] = data.boot.ims ?? [];
  const directMessages: DirectMessage[] = rawIms
    .filter((im) => im.is_open && im.user)
    .map((im) => ({
      id: im.id,
      userId: im.user,
      unread: !!unreadMap[im.id]?.unread,
      lastActivity: latestByIm.get(im.id) || im.updated || (im.created ? im.created * 1000 : undefined),
    }));

  const currentUser = mapUser(data.boot.self);

  const rawStarred: any[] = data.boot.starred ?? [];
  const starredChannelIds: string[] = rawStarred.map((s) => (typeof s === 'string' ? s : s?.channel ?? s?.id)).filter(Boolean);

  return { currentUser, users, channels, directMessages, starredChannelIds };
}

export async function fetchSections(): Promise<ChannelSection[]> {
  try {
    const res = await fetch('/api/sections');
    const data = await res.json();
    if (!data.ok) return [];
    return (data.sections ?? []).map((s: any) => ({ id: s.id, name: s.name, channelIds: s.channelIds ?? [] }));
  } catch {
    return [];
  }
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

// A handful of subtypes are just alternate shapes of an ordinary, visible
// message (bot integrations, file uploads, replies also broadcast to the
// channel) — everything else that isn't a pure duplicate/internal event
// (message_changed etc., which conversations.history/replies never really
// hands us as a distinct row anyway) is a system notice like "X joined the
// channel", which Slack already hands us as ready-to-render text.
const CONTENT_SUBTYPES = new Set(['bot_message', 'file_share', 'thread_broadcast', 'me_message', 'file_comment']);
const HIDE_SUBTYPES = new Set(['message_changed', 'message_deleted', 'message_replied', 'reply_broadcast']);

function mapFile(f: any): SlackFile {
  const mimetype: string | undefined = f.mimetype;
  return {
    id: f.id,
    name: f.name ?? 'file',
    title: f.title,
    mimetype,
    filetype: f.filetype,
    size: f.size,
    isImage: !!mimetype?.startsWith('image/'),
    urlPrivate: f.url_private,
    thumbUrl: f.thumb_720 ?? f.thumb_360 ?? f.thumb_160,
    width: f.thumb_360_w ?? f.original_w,
    height: f.thumb_360_h ?? f.original_h,
    permalink: f.permalink,
  };
}

function mapAttachment(a: any): Attachment {
  return {
    id: a.id,
    color: a.color,
    authorName: a.author_name,
    authorIcon: a.author_icon,
    title: a.title,
    titleLink: a.title_link,
    text: a.text,
    imageUrl: a.image_url,
    footer: a.footer,
    footerIcon: a.footer_icon,
    fields: a.fields,
  };
}

export function mapMessage(m: any): Message {
  const subtype: string | undefined = m.subtype;
  const kind: MessageKind = !subtype || CONTENT_SUBTYPES.has(subtype) ? 'normal' : 'system';
  return {
    id: m.ts,
    ts: m.ts,
    userId: m.user ?? m.bot_id ?? '',
    text: m.text,
    blocks: m.blocks,
    files: Array.isArray(m.files) ? m.files.map(mapFile) : undefined,
    attachments: Array.isArray(m.attachments) ? m.attachments.map(mapAttachment) : undefined,
    time: formatTime(m.ts),
    day: formatDay(m.ts),
    replyCount: m.reply_count,
    replyUsers: m.reply_users,
    reactions: m.reactions,
    kind,
    botName: subtype === 'bot_message' ? m.username : undefined,
    botIcon: subtype === 'bot_message' ? (m.icons?.image_48 ?? m.icons?.image_72 ?? m.icons?.image_36) : undefined,
  };
}

export async function fetchHistory(channelId: string): Promise<Message[]> {
  const res = await fetch(`/api/history?channel=${encodeURIComponent(channelId)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.history failed');
  const messages: any[] = data.messages ?? [];
  return messages
    .filter((m) => m.type === 'message' && !HIDE_SUBTYPES.has(m.subtype))
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
  return messages.filter((m) => m.type === 'message' && !HIDE_SUBTYPES.has(m.subtype)).map(mapMessage);
}

export async function fetchUser(id: string): Promise<User | null> {
  const res = await fetch(`/api/user?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!data.ok) return null;
  return mapUser(data.user);
}

// team.profile.get's field *definitions* (label/ordering) are workspace-wide and
// separate from each user's field *values* (see mapUser's customFields) — fetched
// once and joined against a user's values at render time.
export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  const res = await fetch('/api/profile-fields');
  const data = await res.json();
  if (!data.ok) return [];
  return data.fields ?? [];
}

// Org-wide directory search — the bootstrap user list is capped at 200 for
// payload size, which on a large workspace covers only a sliver of the org.
// The server syncs the full member directory continuously in the background
// starting at boot (see server/index.ts) and this just reads whatever's been
// synced so far, so results improve over the server's uptime rather than
// triggering a scan per query.
export async function searchDirectory(query: string): Promise<{ users: User[]; truncated: boolean }> {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!data.ok) return { users: [], truncated: false };
  const raw: any[] = data.users ?? [];
  return { users: raw.map(mapUser), truncated: !!data.truncated };
}

export async function postMessage(channelId: string, text: string, threadTs?: string, blocks?: unknown) {
  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text, thread_ts: threadTs, blocks }),
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

export async function leaveChannel(channelId: string) {
  const res = await fetch('/api/channel/leave', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.leave failed');
  return data;
}

export async function markChannelRead(channelId: string, ts: string) {
  const res = await fetch('/api/mark', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ts }),
  });
  return res.json();
}

export async function toggleStar(channelId: string, remove: boolean) {
  const res = await fetch('/api/star', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, remove }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'stars.add/remove failed');
  return data;
}

export async function fetchPins(channelId: string): Promise<string[]> {
  const res = await fetch(`/api/pins?channel=${encodeURIComponent(channelId)}`);
  const data = await res.json();
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items.map((it) => it.message?.ts ?? it.created ?? it.channel).filter(Boolean);
}

export async function togglePin(channelId: string, ts: string, remove: boolean) {
  const res = await fetch('/api/pin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ts, remove }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'pins.add/remove failed');
  return data;
}

export async function getPermalink(channelId: string, ts: string): Promise<string | null> {
  const res = await fetch(`/api/permalink?channel=${encodeURIComponent(channelId)}&ts=${encodeURIComponent(ts)}`);
  const data = await res.json();
  if (!data.ok) return null;
  return data.permalink ?? null;
}

export async function addReminder(text: string, time: string) {
  const res = await fetch('/api/remind', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, time }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'reminders.add failed');
  return data;
}

export async function fetchAllEmoji(): Promise<Record<string, string>> {
  const res = await fetch('/api/emojis');
  const data = await res.json();
  if (!data.ok) return {};
  return data.emoji ?? {};
}

export async function fetchSaved(): Promise<SavedItem[]> {
  const res = await fetch('/api/saved');
  const data = await res.json();
  if (!data.ok) return [];
  // saved.list returns `saved_items`, each shaped like { item_id (the channel),
  // item_type: 'message', ts, ... } — item_id/ts sit at the top level, not nested.
  const items: any[] = data.saved_items ?? data.items ?? [];
  return items
    .filter((it) => !it.item_type || it.item_type === 'message')
    .map((it) => ({
      channelId: it.item_id ?? it.channel_id ?? it.channel,
      ts: it.ts ?? it.message_ts,
    }))
    .filter((it): it is SavedItem => !!it.channelId && !!it.ts);
}

export async function openDm(userId: string): Promise<string | null> {
  const res = await fetch('/api/dm/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();
  if (!data.ok) return null;
  return data.channel?.id ?? null;
}

export async function closeDm(channelId: string) {
  const res = await fetch('/api/dm/close', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.close failed');
  return data;
}

export interface SearchResult {
  channelId: string;
  channelName: string;
  ts: string;
  userId: string;
  text: string;
}

export async function searchMessages(
  query: string,
  opts?: { sort?: 'score' | 'timestamp'; sortDir?: 'asc' | 'desc' },
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.sortDir) params.set('sort_dir', opts.sortDir);
  const res = await fetch(`/api/search?${params.toString()}`);
  const data = await res.json();
  if (!data.ok) return [];
  const matches: any[] = data.messages?.matches ?? [];
  return matches.map((m) => ({
    channelId: m.channel?.id,
    channelName: m.channel?.name,
    ts: m.ts,
    userId: m.user,
    text: m.text ?? '',
  }));
}

export async function fetchMentions(selfUserId: string): Promise<ActivityItem[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(`<@${selfUserId}>`)}`);
  const data = await res.json();
  if (!data.ok) return [];
  const matches: any[] = data.messages?.matches ?? [];
  return matches.map((m) => ({
    id: `${m.channel?.id}-${m.ts}`,
    kind: 'mention' as const,
    channelId: m.channel?.id,
    ts: m.ts,
    userId: m.user,
    text: m.text ?? '',
    time: parseFloat(m.ts) * 1000,
  }));
}

// A Slack file's url_private/thumb URLs require the session cookie to fetch,
// which only the server holds — this routes the browser's <img>/<a> requests
// through our own proxy instead of hotlinking Slack directly.
export function fileProxyUrl(url: string): string {
  return `/api/file?url=${encodeURIComponent(url)}`;
}

export async function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  form.append('channel', channelId);
  form.append('filename', file.name);
  if (threadTs) form.append('thread_ts', threadTs);
  if (comment) form.append('comment', comment);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'file upload failed');
}

export async function fetchBrowsableChannels(query: string): Promise<BrowsableChannel[]> {
  const res = await fetch(`/api/channels/browse?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!data.ok) return [];
  const raw: any[] = data.channels ?? [];
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    private: !!c.is_private,
    topic: c.topic?.value ?? c.purpose?.value ?? '',
    memberCount: c.num_members,
  }));
}

export async function joinChannel(channelId: string): Promise<Channel> {
  const res = await fetch('/api/channels/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.join failed');
  const c = data.channel;
  return { id: c.id, name: c.name, private: !!c.is_private, topic: c.topic?.value ?? c.purpose?.value ?? '', unread: false };
}

export async function createChannel(name: string, isPrivate: boolean): Promise<Channel> {
  const res = await fetch('/api/channels/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, isPrivate }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.create failed');
  const c = data.channel;
  return { id: c.id, name: c.name, private: !!c.is_private, topic: '', unread: false };
}

export interface PinnedMessage {
  ts: string;
  message: Message | null;
}

export async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const res = await fetch(`/api/pins?channel=${encodeURIComponent(channelId)}`);
  const data = await res.json();
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items
    .filter((it) => it.type === 'message' && it.message)
    .map((it) => ({ ts: it.message.ts, message: mapMessage(it.message) }));
}

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const res = await fetch('/api/status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, emoji, expiration }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'users.profile.set failed');
}

export async function setPresence(presence: 'auto' | 'away'): Promise<void> {
  const res = await fetch('/api/presence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ presence }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'users.setPresence failed');
}

export async function setMutedChannels(channelIds: string[]): Promise<void> {
  // Best-effort: this uses the same "prefs blob" mechanism the real webapp
  // saves all of its local settings through, not a documented api.slack.com
  // method — treated as non-critical since mute is also kept client-side.
  try {
    await fetch('/api/mute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channelIds }),
    });
  } catch {
    // non-fatal — mute still applies locally even if the sync fails
  }
}

export async function setDndSnooze(minutes: number): Promise<void> {
  const res = await fetch('/api/dnd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ minutes }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'dnd.setSnooze failed');
}

export async function endDndSnooze(): Promise<void> {
  const res = await fetch('/api/dnd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ minutes: 0 }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'dnd.endSnooze failed');
}

export async function fetchCanvas(fileId: string): Promise<string | null> {
  const res = await fetch(`/api/canvas?file=${encodeURIComponent(fileId)}`);
  const data = await res.json();
  if (!data.ok) return null;
  return data.content ?? '';
}

export async function createChannelCanvas(channelId: string): Promise<string | null> {
  const res = await fetch('/api/canvas/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId }),
  });
  const data = await res.json();
  if (!data.ok) return null;
  return data.fileId ?? null;
}

export async function saveCanvas(fileId: string, markdown: string): Promise<void> {
  const res = await fetch('/api/canvas/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file: fileId, markdown }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'canvases.edit failed');
}

export async function setChannelTopic(channelId: string, topic: string): Promise<void> {
  const res = await fetch('/api/channel/topic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, topic }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'conversations.setTopic failed');
}

export async function runSlashCommand(channelId: string, command: string, text: string): Promise<string | null> {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, command, text }),
  });
  const data = await res.json();
  if (!data.ok) return data.error ?? 'Command not supported by this client.';
  return null;
}
