const PORT = 5174;

const DOMAIN = process.env.SLACK_DOMAIN!;
const TOKEN = process.env.SLACK_TOKEN!;
const COOKIE = process.env.SLACK_COOKIE!;
const ROUTE = process.env.SLACK_ROUTE!;

if (!DOMAIN || !TOKEN || !COOKIE || !ROUTE) {
  throw new Error('Missing SLACK_DOMAIN / SLACK_TOKEN / SLACK_COOKIE / SLACK_ROUTE in .env');
}

async function callSlack(method: string, params: Record<string, string>) {
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
// Real-time relay: connect to Slack's own Edge Gateway websocket server-side
// (keeps the token off the browser) and fan its events out to every connected
// client over our own /ws endpoint. Classic rtm.connect is permanently
// unavailable on Enterprise Grid workspaces like this one (enterprise_is_restricted),
// so we speak the same protocol the official web/desktop client uses instead.
// If the gateway connection is down, fall back to polling Slack ourselves —
// still just a single relayed connection from the browser's point of view,
// never a per-second fetch loop in the client.
// ---------------------------------------------------------------------------

type ClientSocket = { send(data: string): void };
const clients = new Set<ClientSocket>();
let gatewayConnected = false;
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
  broadcast({ type: '_status', connected: gatewayConnected });
}

let gatewaySocket: WebSocket | null = null;
let gatewayRetryDelay = 2000;
const GATEWAY_MAX_RETRY_DELAY = 60000;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

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

// Slack's Enterprise Grid gateway addresses the "org-wide" connection by a team id
// that mirrors the enterprise id with its leading "E" swapped for "T" — not
// documented anywhere, found by inspecting the official client's own websocket
// handshake in devtools.
const ENTERPRISE_ID = ROUTE.split(':')[0];
const GATEWAY_TEAM_ID = 'T' + ENTERPRISE_ID.slice(1);

function buildGatewayUrl() {
  const shard = 1 + Math.floor(Math.random() * 3);
  const params = new URLSearchParams({
    token: TOKEN,
    sync_desync: '1',
    slack_client: 'desktop',
    start_args: `?agent=client&org_wide_aware=true&agent_version=${Date.now()}&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true`,
    no_query_on_subscribe: '1',
    flannel: '3',
    lazy_channels: '1',
    gateway_server: `${GATEWAY_TEAM_ID}-${shard}`,
    enterprise_id: ENTERPRISE_ID,
    batch_presence_aware: '1',
  });
  return `wss://wss-primary.slack.com/?${params}`;
}

function connectGateway() {
  try {
    const socket = new WebSocket(buildGatewayUrl(), { headers: { cookie: COOKIE } } as any);
    gatewaySocket = socket;

    socket.addEventListener('open', () => {
      console.log('Connected to Slack Edge gateway');
      gatewayConnected = true;
      gatewayRetryDelay = 2000;
      stopFallbackPolling();
      broadcastStatus();
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== 'pong' && payload.type !== 'reconnect_url') broadcast(payload);
      } catch {
        // ignore malformed frames
      }
    });

    const onDown = () => {
      if (gatewaySocket !== socket) return;
      gatewaySocket = null;
      gatewayConnected = false;
      broadcastStatus();
      startFallbackPolling();
      setTimeout(connectGateway, gatewayRetryDelay);
      gatewayRetryDelay = Math.min(gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
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
    console.warn('Failed to connect to Slack gateway, retrying:', err);
    startFallbackPolling();
    setTimeout(connectGateway, gatewayRetryDelay);
    gatewayRetryDelay = Math.min(gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  }
}

connectGateway();

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
  async fetch(req) {
    const url = new URL(req.url);

    try {
      if (url.pathname === '/api/bootstrap') {
        const [boot, users] = await Promise.all([
          callSlack('client.userBoot', {}),
          callSlack('users.list', { limit: '200' }),
        ]);
        return new Response(JSON.stringify({ boot, users }), { headers: cors });
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

      if (url.pathname === '/api/emoji') {
        const name = url.searchParams.get('name');
        if (!name) return new Response('missing name', { status: 400, headers: cors });
        const map = await getEmojiMap();
        return new Response(JSON.stringify({ ok: true, url: map[name] ?? null }), { headers: cors });
      }

      if (url.pathname === '/api/user') {
        const user = url.searchParams.get('id');
        if (!user) return new Response('missing id', { status: 400, headers: cors });
        const data = await callSlack('users.info', { user });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/send' && req.method === 'POST') {
        const { channel, text, thread_ts } = (await req.json()) as {
          channel: string;
          text: string;
          thread_ts?: string;
        };
        const params: Record<string, string> = { channel, text };
        if (thread_ts) params.thread_ts = thread_ts;
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
      ws.send(JSON.stringify({ type: '_status', connected: gatewayConnected }));
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
