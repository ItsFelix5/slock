// The one thing a browser genuinely cannot do itself: Slack's internal API
// needs both an xoxc token *and* a session cookie, and browsers refuse to let
// JS set a `Cookie` header (forbidden by the Fetch spec) — so every Slack
// call has to be relayed through a real server. The Edge Gateway websocket
// needs that same cookie on its handshake, which the browser's native
// WebSocket has no way to attach either, so the real-time connection lives
// here too, fanned out to connected browser clients.
//
// This module holds no business logic — no endpoint shaping, no response
// mapping. That all lives client-side in @slock/slack-api. It's imported by
// both the dev-time Vite plugin (server/dev-plugin.ts, runs under Node) and
// the production entry point (server/index.ts, runs under Bun), so it only
// uses portable APIs (fetch, the `ws` package) rather than Bun-only globals.
import { WebSocket } from "ws";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

const DOMAIN = requireEnv("SLACK_DOMAIN");
const TOKEN = requireEnv("SLACK_TOKEN");
const COOKIE = requireEnv("SLACK_COOKIE");
const ROUTE = requireEnv("SLACK_ROUTE");

export async function callSlack(method: string, params: Record<string, string> = {}) {
  const body = new URLSearchParams({ token: TOKEN, ...params });
  const url = `https://${DOMAIN}/api/${method}?slack_route=${encodeURIComponent(ROUTE)}&_x_app_name=client`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: COOKIE,
    },
    body: body.toString(),
  });
  return res.json();
}

const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };

export async function slackRelayResponse(
  method: string,
  params: Record<string, string>,
): Promise<Response> {
  const data = await callSlack(method, params);
  return new Response(JSON.stringify(data), { headers: cors });
}

// Slack's Edge API cache service (a different host from the regular Web API,
// JSON bodies instead of form-encoded) — the official client reads workspace
// data that Enterprise Grid blocks on the Web API from here instead, e.g.
// channel membership, where conversations.members is enterprise_is_restricted.
async function callSlackEdge(method: string, params: Record<string, unknown>) {
  const res = await fetch(`https://edgeapi.slack.com/cache/${ENTERPRISE_ID}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ token: TOKEN, ...params }),
  });
  return res.json();
}

export async function slackEdgeRelayResponse(
  method: string,
  params: Record<string, unknown>,
): Promise<Response> {
  const data = await callSlackEdge(method, params);
  return new Response(JSON.stringify(data), { headers: cors });
}

// `chat.getPermalink` is blocked by `enterprise_is_restricted` on Enterprise
// Grid workspaces like this one — the client instead builds permalink URLs
// itself from the workspace domain, which only the server knows (env-only).
export function configResponse(): Response {
  return new Response(JSON.stringify({ domain: DOMAIN }), { headers: cors });
}

// Slack file URLs require the session cookie the browser never gets — host is
// restricted to Slack's own file domains so this can't become an open SSRF proxy.
const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/];

export async function fileProxyResponse(fileUrl: string | null): Promise<Response> {
  if (!fileUrl) return new Response("missing url", { status: 400, headers: cors });
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return new Response("invalid url", { status: 400, headers: cors });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { status: 403, headers: cors });
  }
  const fileRes = await fetch(parsed, { headers: { cookie: COOKIE } });
  if (!fileRes.ok || !fileRes.body) {
    return new Response("failed to fetch file", { status: 502, headers: cors });
  }
  return new Response(fileRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}

// ---------------------------------------------------------------------------
// Real-time relay: connect to Slack's own Edge Gateway websocket server-side
// (the only way to attach the session cookie) and fan its events out to every
// connected browser client. Classic rtm.connect is permanently unavailable on
// Enterprise Grid workspaces like this one, so we speak the same protocol the
// official web/desktop client uses instead. If the gateway connection is
// down, fall back to polling Slack ourselves.
// ---------------------------------------------------------------------------

export type ClientSocket = { send(data: string): void };
export const clients = new Set<ClientSocket>();
let gatewayConnected = false;
export function isGatewayConnected() {
  return gatewayConnected;
}

const watchedChannels = new Set<string>();
const watchedThreads = new Map<string, string>();

export function watchChannel(channel: string) {
  watchedChannels.add(channel);
}
export function unwatchChannel(channel: string) {
  watchedChannels.delete(channel);
}
export function watchThread(channel: string, ts: string) {
  watchedThreads.set(ts, channel);
}
export function unwatchThread(ts: string) {
  watchedThreads.delete(ts);
}

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
  broadcast({ type: "_status", connected: gatewayConnected });
}

export function statusMessage(): string {
  return JSON.stringify({ type: "_status", connected: gatewayConnected });
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
        const data = await callSlack("conversations.history", { channel, limit: "60" });
        if (data.ok)
          broadcast({ type: "_history_snapshot", channel, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
    for (const [ts, channel] of watchedThreads) {
      try {
        const data = await callSlack("conversations.replies", { channel, ts, limit: "200" });
        if (data.ok)
          broadcast({ type: "_replies_snapshot", channel, ts, messages: data.messages ?? [] });
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
const ENTERPRISE_ID = ROUTE.split(":")[0];
const GATEWAY_TEAM_ID = `T${ENTERPRISE_ID.slice(1)}`;

function buildGatewayUrl() {
  const shard = 1 + Math.floor(Math.random() * 3);
  const params = new URLSearchParams({
    token: TOKEN,
    sync_desync: "1",
    slack_client: "desktop",
    start_args: `?agent=client&org_wide_aware=true&agent_version=${Date.now()}&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true`,
    no_query_on_subscribe: "1",
    flannel: "3",
    lazy_channels: "1",
    gateway_server: `${GATEWAY_TEAM_ID}-${shard}`,
    enterprise_id: ENTERPRISE_ID,
    batch_presence_aware: "1",
  });
  return `wss://wss-primary.slack.com/?${params}`;
}

function connectGateway() {
  try {
    const socket = new WebSocket(buildGatewayUrl(), { headers: { cookie: COOKIE } });
    gatewaySocket = socket;

    socket.addEventListener("open", () => {
      console.log("Connected to Slack Edge gateway");
      gatewayConnected = true;
      gatewayRetryDelay = 2000;
      stopFallbackPolling();
      broadcastStatus();
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== "pong" && payload.type !== "reconnect_url")
          broadcast(payload);
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
    socket.addEventListener("close", onDown);
    socket.addEventListener("error", onDown);

    const pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: "ping", id: Date.now() }));
      } catch {
        clearInterval(pingTimer);
      }
    }, 30000);
    socket.addEventListener("close", () => clearInterval(pingTimer));
  } catch (err) {
    console.warn("Failed to connect to Slack gateway, retrying:", err);
    startFallbackPolling();
    setTimeout(connectGateway, gatewayRetryDelay);
    gatewayRetryDelay = Math.min(gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  }
}

let started = false;
export function startGateway() {
  if (started) return;
  started = true;
  connectGateway();
}

export function handleClientMessage(raw: string) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === "watch_channel" && msg.channel) watchChannel(msg.channel);
    else if (msg.type === "unwatch_channel" && msg.channel) unwatchChannel(msg.channel);
    else if (msg.type === "watch_thread" && msg.channel && msg.ts) watchThread(msg.channel, msg.ts);
    else if (msg.type === "unwatch_thread" && msg.ts) unwatchThread(msg.ts);
  } catch {
    // ignore malformed client frames
  }
}
