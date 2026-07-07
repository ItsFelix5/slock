const PORT = 5174;

const DOMAIN = process.env.SLACK_DOMAIN!;
const TOKEN = process.env.SLACK_TOKEN!;
const COOKIE = process.env.SLACK_COOKIE!;
const ROUTE = process.env.SLACK_ROUTE!;

if (!DOMAIN || !TOKEN || !COOKIE || !ROUTE) {
  throw new Error('Missing SLACK_DOMAIN / SLACK_TOKEN / SLACK_COOKIE / SLACK_ROUTE in .env');
}

async function callSlack(method: string, params: Record<string, string> = {}) {
  const body = new URLSearchParams({ token: TOKEN, ...params });
  const url = `https://${DOMAIN}/api/${method}?slack_route=${encodeURIComponent(ROUTE)}&_x_app_name=client`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: COOKIE,
    },
    body: body.toString(),
  });
  return res.json();
}

const cors = {
  'access-control-allow-origin': 'http://localhost:5173',
  'content-type': 'application/json',
};

let emojiMapPromise: Promise<Record<string, string>> | null = null;

function getEmojiMap() {
  if (!emojiMapPromise) {
    emojiMapPromise = callSlack('emoji.list', {}).then((data) => {
      const raw: Record<string, string> = data.emoji ?? {};
      const resolved: Record<string, string> = {};
      for (const name of Object.keys(raw)) {
        let value = raw[name];
        let hops = 0;
        while (typeof value === 'string' && value.startsWith('alias:') && hops < 5) {
          value = raw[value.slice('alias:'.length)];
          hops++;
        }
        if (typeof value === 'string' && value.startsWith('http')) resolved[name] = value;
      }
      return resolved;
    });
  }
  return emojiMapPromise;
}

// ---------------------------------------------------------------------------
// Real-time relay: connect to Slack's own RTM websocket server-side (keeps the
// token off the browser) and fan its events out to every connected client over
// our own /ws endpoint. If rtm.connect isn't available for this workspace/token
// (Enterprise Grid has been migrating off classic RTM), fall back to polling
// Slack ourselves — still just a single relayed connection from the browser's
// point of view, never a per-second fetch loop in the client.
// ---------------------------------------------------------------------------

type ClientSocket = { send(data: string): void };
const clients = new Set<ClientSocket>();
let rtmConnected = false;
const watchedChannels = new Set<string>();
const watchedThreads = new Map<string, string>(); // ts -> channel

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      // dropped client; the close handler will clean it up
    }
  }
}

function broadcastStatus() {
  broadcast({ type: '_status', connected: rtmConnected });
}

let rtmSocket: WebSocket | null = null;
let rtmRetryDelay = 2000;
const RTM_MAX_RETRY_DELAY = 60000;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

// Errors that mean "this workspace/token will never be able to use RTM" rather than
// "try again in a bit" — Enterprise Grid workspaces commonly reject classic RTM outright.
const RTM_PERMANENT_ERRORS = new Set([
  'enterprise_is_restricted',
  'not_authed',
  'invalid_auth',
  'account_inactive',
  'missing_scope',
  'no_permission',
  'user_is_bot',
]);

function startFallbackPolling() {
  if (fallbackTimer) return;
  fallbackTimer = setInterval(async () => {
    for (const channel of watchedChannels) {
      try {
        const data = await callSlack('conversations.history', { channel, limit: '60' });
        if (data.ok) broadcast({ type: '_history_snapshot', channel, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
    for (const [ts, channel] of watchedThreads) {
      try {
        const data = await callSlack('conversations.replies', { channel, ts, limit: '200' });
        if (data.ok) broadcast({ type: '_replies_snapshot', channel, ts, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
  }, 4000);
}

function stopFallbackPolling() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}

async function connectRtm() {
  try {
    const data = await callSlack('rtm.connect', {});
    if (!data.ok || !data.url) {
      startFallbackPolling();
      if (RTM_PERMANENT_ERRORS.has(data.error)) {
        console.warn(`rtm.connect permanently unavailable (${data.error}) — staying on server-side polling.`);
        return;
      }
      console.warn('rtm.connect unavailable, retrying:', data.error ?? data);
      rtmRetryDelay = Math.min(rtmRetryDelay * 2, RTM_MAX_RETRY_DELAY);
      setTimeout(connectRtm, rtmRetryDelay);
      return;
    }

    const socket = new WebSocket(data.url);
    rtmSocket = socket;

    socket.addEventListener('open', () => {
      console.log('Connected to Slack RTM');
      rtmConnected = true;
      rtmRetryDelay = 2000;
      stopFallbackPolling();
      broadcastStatus();
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== 'pong') broadcast(payload);
      } catch {
        // ignore malformed frames
      }
    });

    const onDown = () => {
      if (rtmSocket !== socket) return;
      rtmSocket = null;
      rtmConnected = false;
      broadcastStatus();
      startFallbackPolling();
      setTimeout(connectRtm, rtmRetryDelay);
      rtmRetryDelay = Math.min(rtmRetryDelay * 2, RTM_MAX_RETRY_DELAY);
    };
    socket.addEventListener('close', onDown);
    socket.addEventListener('error', onDown);

    // Keep the connection alive / detect silently-dead sockets.
    const pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: 'ping', id: Date.now() }));
      } catch {
        clearInterval(pingTimer);
      }
    }, 30000);
    socket.addEventListener('close', () => clearInterval(pingTimer));
  } catch (err) {
    console.warn('Failed to connect to Slack RTM, retrying:', err);
    startFallbackPolling();
    setTimeout(connectRtm, rtmRetryDelay);
    rtmRetryDelay = Math.min(rtmRetryDelay * 2, RTM_MAX_RETRY_DELAY);
  }
}

connectRtm();

// ---------------------------------------------------------------------------
// Org-wide member search: users.list has no server-side name filter, and on a
// ~100k-member workspace the 200-user slice fetched at boot covers a fraction
// of a percent of the org — nowhere near enough for "find a person to DM" or
// @mention autocomplete to work, and Slack's public Web API has no dedicated
// user-search method to call instead.
//
// This mirrors what Slack's own client actually does for this, rather than
// scanning on demand: it doesn't have a magic search RPC either — it builds a
// local replica of the member directory in the background after boot (that's
// the whole reason the desktop/web client ships a local database) and serves
// autocomplete instantly from that. So here: page through users.list's
// documented cursor at a gentle steady rate starting right when the server
// comes up, independent of whether anyone is searching, and let queries just
// read whatever's been synced so far. A big org takes a few minutes to fully
// sync; search quality improves continuously in the background rather than
// bursting a scan into a single request.
// ---------------------------------------------------------------------------

const userDirectory: any[] = [];
let directoryCursor = '';
let directorySynced = false;

async function syncDirectoryStep() {
  const data = await callSlack('users.list', { limit: '1000', cursor: directoryCursor });
  if (!data.ok) {
    directorySynced = true;
    return;
  }
  userDirectory.push(...(data.members ?? []));
  const nextCursor = data.response_metadata?.next_cursor;
  if (!nextCursor) {
    directorySynced = true;
    return;
  }
  directoryCursor = nextCursor;
}

async function runBackgroundDirectorySync() {
  while (!directorySynced) {
    try {
      await syncDirectoryStep();
    } catch {
      // transient network error; next tick retries from the same cursor
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`Member directory sync complete: ${userDirectory.length} users cached.`);
}

runBackgroundDirectorySync();

function matchesQuery(u: any, q: string): boolean {
  if (u.deleted) return false;
  const haystacks = [u.profile?.display_name, u.profile?.real_name, u.real_name, u.name, u.profile?.email];
  return haystacks.some((h) => typeof h === 'string' && h.toLowerCase().includes(q));
}

function searchDirectory(query: string, limit = 30) {
  const q = query.trim().toLowerCase();
  if (!q) return { users: [], truncated: false };
  const found = userDirectory.filter((u) => matchesQuery(u, q)).slice(0, limit);
  return { users: found, truncated: found.length >= limit || !directorySynced };
}

// Slack file URLs (url_private / thumb_*) require the session cookie to fetch —
// the browser never gets that cookie, so images/files are proxied through here.
// Host is restricted to Slack's own file domains so this can't become an open
// SSRF proxy for arbitrary URLs.
const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/];

function isAllowedFileHost(hostname: string): boolean {
  return ALLOWED_FILE_HOSTS.some((re) => re.test(hostname));
}

// ---------------------------------------------------------------------------
// Channel directory: same rationale/shape as the member directory above —
// conversations.list has no name filter, so page it in the background and
// search the cache. Channel counts run far smaller than a huge org's member
// count, but the mechanism is identical.
// ---------------------------------------------------------------------------

const channelDirectory: any[] = [];
let channelDirectoryCursor = '';
let channelDirectorySynced = false;

async function syncChannelDirectoryStep() {
  const data = await callSlack('conversations.list', {
    limit: '1000',
    cursor: channelDirectoryCursor,
    types: 'public_channel',
    exclude_archived: 'true',
  });
  if (!data.ok) {
    channelDirectorySynced = true;
    return;
  }
  channelDirectory.push(...(data.channels ?? []));
  const nextCursor = data.response_metadata?.next_cursor;
  if (!nextCursor) {
    channelDirectorySynced = true;
    return;
  }
  channelDirectoryCursor = nextCursor;
}

async function runBackgroundChannelSync() {
  while (!channelDirectorySynced) {
    try {
      await syncChannelDirectoryStep();
    } catch {
      // transient network error; next tick retries from the same cursor
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`Channel directory sync complete: ${channelDirectory.length} channels cached.`);
}

runBackgroundChannelSync();

function searchChannelDirectory(query: string, limit = 40) {
  const q = query.trim().toLowerCase();
  const pool = channelDirectory.filter((c) => !c.is_archived && !c.is_member);
  const matches = q ? pool.filter((c) => (c.name ?? '').toLowerCase().includes(q)) : pool;
  return { channels: matches.slice(0, limit), truncated: matches.length > limit || !channelDirectorySynced };
}

function extractChannelSections(data: any): { id: string; name: string; channelIds: string[] }[] | null {
  const raw = data?.channel_sections ?? data?.channelSections;
  if (!Array.isArray(raw)) return null;
  return raw
    .map((s: any) => ({
      id: s.channel_section_id ?? s.id ?? s.name,
      name: s.name ?? 'Channels',
      channelIds: s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? [],
    }))
    // Slack always includes built-in pseudo-sections (stars, direct_messages, recent_apps, ...)
    // even when the user has never created a custom category — they're always empty in that
    // case, so drop anything with no channels rather than rendering empty section headers.
    .filter((s: any) => s.id && Array.isArray(s.channelIds) && s.channelIds.length > 0);
}

Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('upgrade failed', { status: 400 });
    }

    try {
      if (url.pathname === '/api/bootstrap') {
        // client.counts is what the real webapp uses to paint sidebar unread dots/mention
        // badges right at boot without fetching full history for every channel — without
        // it, unread state only exists after a live websocket event during the session,
        // so a reload wipes every unread indicator. Best-effort: if the shape doesn't
        // match what we expect, bootstrap still succeeds with today's "nothing unread"
        // fallback rather than failing the whole app.
        const [boot, users, counts] = await Promise.all([
          callSlack('client.userBoot', {}),
          callSlack('users.list', { limit: '200' }),
          callSlack('client.counts', {}).catch(() => ({ ok: false })),
        ]);
        return new Response(JSON.stringify({ boot, users, counts }), { headers: cors });
      }

      if (url.pathname === '/api/channel/info') {
        const channel = url.searchParams.get('channel');
        if (!channel) return new Response('missing channel', { status: 400, headers: cors });
        const data = await callSlack('conversations.info', { channel });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/sections') {
        const data = await callSlack('users.channelSections.list', {});
        const sections = data.ok ? extractChannelSections(data) : null;
        return new Response(JSON.stringify({ ok: !!sections, sections: sections ?? [] }), { headers: cors });
      }

      if (url.pathname === '/api/history') {
        const channel = url.searchParams.get('channel');
        if (!channel) return new Response('missing channel', { status: 400, headers: cors });
        const data = await callSlack('conversations.history', { channel, limit: '60' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/replies') {
        const channel = url.searchParams.get('channel');
        const ts = url.searchParams.get('ts');
        if (!channel || !ts) return new Response('missing channel/ts', { status: 400, headers: cors });
        const data = await callSlack('conversations.replies', { channel, ts, limit: '200' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/emojis') {
        const map = await getEmojiMap();
        const body = JSON.stringify({ ok: true, emoji: map });
        // Large workspaces can have tens of thousands of custom emoji (multiple MB of
        // JSON) — gzip cuts that by roughly 8x, and the cache header means a browser
        // reload doesn't refetch it at all within the window.
        const acceptsGzip = (req.headers.get('accept-encoding') ?? '').includes('gzip');
        const headers = { ...cors, 'cache-control': 'public, max-age=1800' };
        if (acceptsGzip) {
          return new Response(Bun.gzipSync(Buffer.from(body)), {
            headers: { ...headers, 'content-encoding': 'gzip' },
          });
        }
        return new Response(body, { headers });
      }

      if (url.pathname === '/api/user') {
        const user = url.searchParams.get('id');
        if (!user) return new Response('missing id', { status: 400, headers: cors });
        const data = await callSlack('users.info', { user });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/users/search') {
        const q = url.searchParams.get('q') ?? '';
        const result = await searchDirectory(q);
        return new Response(JSON.stringify({ ok: true, ...result }), { headers: cors });
      }

      if (url.pathname === '/api/search') {
        const query = url.searchParams.get('q');
        if (!query) return new Response('missing q', { status: 400, headers: cors });
        const sort = url.searchParams.get('sort') === 'score' ? 'score' : 'timestamp';
        const sortDir = url.searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc';
        const data = await callSlack('search.messages', { query, sort, sort_dir: sortDir, count: '40' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/saved') {
        const data = await callSlack('saved.list', { limit: '40' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/dm/open' && req.method === 'POST') {
        const { userId } = (await req.json()) as { userId: string };
        const data = await callSlack('conversations.open', { users: userId });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/send' && req.method === 'POST') {
        const { channel, text, thread_ts, blocks } = (await req.json()) as {
          channel: string;
          text: string;
          thread_ts?: string;
          blocks?: unknown;
        };
        const params: Record<string, string> = { channel, text };
        if (thread_ts) params.thread_ts = thread_ts;
        if (blocks) params.blocks = JSON.stringify(blocks);
        const data = await callSlack('chat.postMessage', params);
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/edit' && req.method === 'POST') {
        const { channel, ts, text } = (await req.json()) as { channel: string; ts: string; text: string };
        const data = await callSlack('chat.update', { channel, ts, text });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/delete' && req.method === 'POST') {
        const { channel, ts } = (await req.json()) as { channel: string; ts: string };
        const data = await callSlack('chat.delete', { channel, ts });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/react' && req.method === 'POST') {
        const { channel, timestamp, name, remove } = (await req.json()) as {
          channel: string;
          timestamp: string;
          name: string;
          remove?: boolean;
        };
        const data = await callSlack(remove ? 'reactions.remove' : 'reactions.add', {
          channel,
          timestamp,
          name,
        });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/save' && req.method === 'POST') {
        const { channel, ts, remove } = (await req.json()) as {
          channel: string;
          ts: string;
          remove?: boolean;
        };
        const data = await callSlack(remove ? 'saved.delete' : 'saved.add', {
          item_type: 'message',
          item_id: channel,
          ts,
        });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/star' && req.method === 'POST') {
        const { channel, remove } = (await req.json()) as { channel: string; remove?: boolean };
        const data = await callSlack(remove ? 'stars.remove' : 'stars.add', { channel });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/channel/leave' && req.method === 'POST') {
        const { channel } = (await req.json()) as { channel: string };
        const data = await callSlack('conversations.leave', { channel });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/mark' && req.method === 'POST') {
        const { channel, ts } = (await req.json()) as { channel: string; ts: string };
        const data = await callSlack('conversations.mark', { channel, ts });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/pins' && req.method === 'GET') {
        const channel = url.searchParams.get('channel');
        if (!channel) return new Response('missing channel', { status: 400, headers: cors });
        const data = await callSlack('pins.list', { channel });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/pin' && req.method === 'POST') {
        const { channel, ts, remove } = (await req.json()) as { channel: string; ts: string; remove?: boolean };
        const data = await callSlack(remove ? 'pins.remove' : 'pins.add', { channel, timestamp: ts });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/permalink' && req.method === 'GET') {
        const channel = url.searchParams.get('channel');
        const ts = url.searchParams.get('ts');
        if (!channel || !ts) return new Response('missing channel/ts', { status: 400, headers: cors });
        const data = await callSlack('chat.getPermalink', { channel, message_ts: ts });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/remind' && req.method === 'POST') {
        const { text, time } = (await req.json()) as { text: string; time: string };
        const data = await callSlack('reminders.add', { text, time });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/file') {
        const fileUrl = url.searchParams.get('url');
        if (!fileUrl) return new Response('missing url', { status: 400, headers: cors });
        let parsed: URL;
        try {
          parsed = new URL(fileUrl);
        } catch {
          return new Response('invalid url', { status: 400, headers: cors });
        }
        if (!isAllowedFileHost(parsed.hostname)) {
          return new Response('host not allowed', { status: 403, headers: cors });
        }
        const fileRes = await fetch(parsed, { headers: { cookie: COOKIE } });
        if (!fileRes.ok || !fileRes.body) {
          return new Response('failed to fetch file', { status: 502, headers: cors });
        }
        return new Response(fileRes.body, {
          headers: {
            'access-control-allow-origin': cors['access-control-allow-origin'],
            'content-type': fileRes.headers.get('content-type') ?? 'application/octet-stream',
            'cache-control': 'private, max-age=3600',
          },
        });
      }

      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file') as File | null;
        const channel = form.get('channel') as string | null;
        const filename = (form.get('filename') as string | null) ?? file?.name ?? 'file';
        const threadTs = form.get('thread_ts') as string | null;
        const initialComment = form.get('comment') as string | null;
        if (!file || !channel) return new Response(JSON.stringify({ ok: false, error: 'missing file/channel' }), { status: 400, headers: cors });

        // Modern (non-deprecated) Slack upload flow: reserve an upload URL, POST the
        // raw bytes to it, then tell Slack to attach the finished upload to a channel.
        const buffer = await file.arrayBuffer();
        const reserve = await callSlack('files.getUploadURLExternal', {
          filename,
          length: String(buffer.byteLength),
        });
        if (!reserve.ok) return new Response(JSON.stringify(reserve), { headers: cors });

        const uploadForm = new FormData();
        uploadForm.append('file', new Blob([buffer]), filename);
        const putRes = await fetch(reserve.upload_url, { method: 'POST', body: uploadForm });
        if (!putRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: 'upload_failed' }), { headers: cors });
        }

        const completeParams: Record<string, string> = {
          files: JSON.stringify([{ id: reserve.file_id, title: filename }]),
          channel_id: channel,
        };
        if (threadTs) completeParams.thread_ts = threadTs;
        if (initialComment) completeParams.initial_comment = initialComment;
        const complete = await callSlack('files.completeUploadExternal', completeParams);
        return new Response(JSON.stringify(complete), { headers: cors });
      }

      if (url.pathname === '/api/channels/browse') {
        const q = url.searchParams.get('q') ?? '';
        const result = searchChannelDirectory(q);
        return new Response(JSON.stringify({ ok: true, ...result }), { headers: cors });
      }

      if (url.pathname === '/api/channels/join' && req.method === 'POST') {
        const { channel } = (await req.json()) as { channel: string };
        const data = await callSlack('conversations.join', { channel });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/channels/create' && req.method === 'POST') {
        const { name, isPrivate } = (await req.json()) as { name: string; isPrivate?: boolean };
        const data = await callSlack('conversations.create', { name, is_private: isPrivate ? 'true' : 'false' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/status' && req.method === 'POST') {
        const { text, emoji, expiration } = (await req.json()) as { text: string; emoji: string; expiration: number };
        const profile = JSON.stringify({ status_text: text, status_emoji: emoji, status_expiration: expiration });
        const data = await callSlack('users.profile.set', { profile });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/presence' && req.method === 'POST') {
        const { presence } = (await req.json()) as { presence: 'auto' | 'away' };
        const data = await callSlack('users.setPresence', { presence });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/mute' && req.method === 'POST') {
        // Best-effort: muted_channels is the same client-prefs blob mechanism the real
        // webapp saves all of its local settings through, not a documented api.slack.com
        // method — the client treats this as non-critical since mute is kept locally too.
        const { channelIds } = (await req.json()) as { channelIds: string[] };
        const data = await callSlack('users.prefs.set', { name: 'muted_channels', value: channelIds.join(',') });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/dnd' && req.method === 'POST') {
        const { minutes } = (await req.json()) as { minutes: number };
        const data = minutes > 0
          ? await callSlack('dnd.setSnooze', { num_minutes: String(minutes) })
          : await callSlack('dnd.endSnooze', {});
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/canvas') {
        // Reading a canvas's actual document content back out isn't something we can
        // fully verify without live testing against a real canvas — this is a
        // best-effort attempt (fetch the backing file's content and hand back
        // whatever text comes back); the client always keeps a permalink fallback.
        const fileId = url.searchParams.get('file');
        if (!fileId) return new Response('missing file', { status: 400, headers: cors });
        const info = await callSlack('files.info', { file: fileId });
        if (!info.ok) return new Response(JSON.stringify(info), { headers: cors });
        const downloadUrl = info.file?.url_private_download ?? info.file?.url_private;
        if (!downloadUrl) return new Response(JSON.stringify({ ok: false, error: 'no_content_url' }), { headers: cors });
        try {
          const contentRes = await fetch(downloadUrl, { headers: { cookie: COOKIE } });
          const content = await contentRes.text();
          return new Response(
            JSON.stringify({ ok: true, content, permalink: info.file?.permalink }),
            { headers: cors },
          );
        } catch {
          return new Response(JSON.stringify({ ok: false, error: 'fetch_failed', permalink: info.file?.permalink }), { headers: cors });
        }
      }

      if (url.pathname === '/api/canvas/create' && req.method === 'POST') {
        const { channel } = (await req.json()) as { channel: string };
        const data = await callSlack('conversations.canvases.create', { channel_id: channel });
        return new Response(JSON.stringify({ ok: data.ok, fileId: data.canvas_id, error: data.error }), { headers: cors });
      }

      if (url.pathname === '/api/canvas/edit' && req.method === 'POST') {
        const { file, markdown } = (await req.json()) as { file: string; markdown: string };
        const changes = JSON.stringify([
          { operation: 'replace', document_content: { type: 'markdown', markdown } },
        ]);
        const data = await callSlack('canvases.edit', { canvas_id: file, changes });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/channel/topic' && req.method === 'POST') {
        const { channel, topic } = (await req.json()) as { channel: string; topic: string };
        const data = await callSlack('conversations.setTopic', { channel, topic });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/command' && req.method === 'POST') {
        // Best-effort: there's no documented public method for dispatching a slash
        // command from a client — this mirrors the internal call the real webapp
        // makes, which we can't fully verify without live testing. Failure is
        // surfaced honestly to the user rather than assumed to have worked.
        const { channel, command, text } = (await req.json()) as { channel: string; command: string; text: string };
        const data = await callSlack('chat.command', { channel, command, text });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      return new Response('not found', { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: cors,
      });
    }
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(JSON.stringify({ type: '_status', connected: rtmConnected }));
    },
    close(ws) {
      clients.delete(ws);
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'watch_channel' && msg.channel) watchedChannels.add(msg.channel);
        else if (msg.type === 'unwatch_channel' && msg.channel) watchedChannels.delete(msg.channel);
        else if (msg.type === 'watch_thread' && msg.channel && msg.ts) watchedThreads.set(msg.ts, msg.channel);
        else if (msg.type === 'unwatch_thread' && msg.ts) watchedThreads.delete(msg.ts);
      } catch {
        // ignore malformed client frames
      }
    },
  },
});

console.log(`Slack proxy listening on http://localhost:${PORT}`);
