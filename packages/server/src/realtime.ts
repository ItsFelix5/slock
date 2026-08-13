import { rewriteSlackAssetUrls } from "./assets.js";
import { type Credentials, slackCookieHeader, teamIdFromRoute } from "./auth.js";
import { recordSeenActive } from "./presence/lastSeen.js";
import { trimSlackGatewayPayload } from "./trim/slackGatewayPayload.js";

export type ClientSocket = { send(data: string): void };

type ConnectionState = {
  creds: Credentials;
  socket: ClientSocket;
  gatewaySocket: WebSocket | null;
  gatewayConnected: boolean;
  gatewayRetryDelay: number;
  gatewayRetryTimer: ReturnType<typeof setTimeout> | null;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  fallbackPollRunning: boolean;
  watchedChannels: Set<string>;
  watchedThreads: Map<string, string>;
  closed: boolean;
};

const connections = new WeakMap<ClientSocket, ConnectionState>();
const GATEWAY_MAX_RETRY_DELAY = 60000;

function send(state: ConnectionState, payload: unknown) {
  try {
    state.socket.send(JSON.stringify(payload));
  } catch {}
}

function sendStatus(state: ConnectionState) {
  send(state, { connected: state.gatewayConnected, type: "_status" });
}

export function statusMessage(connected: boolean): string {
  return JSON.stringify({ connected, type: "_status" });
}

function stopFallbackPolling(state: ConnectionState) {
  if (state.fallbackTimer) {
    clearInterval(state.fallbackTimer);
    state.fallbackTimer = null;
  }
}

function buildGatewayUrl(current: Credentials) {
  const [enterpriseId] = current.route.split(":");
  const gatewayTeamId = teamIdFromRoute(current.route) ?? enterpriseId;
  const shard = 1 + Math.floor(Math.random() * 3);
  const params = new URLSearchParams({
    batch_presence_aware: "1",
    enterprise_id: enterpriseId,
    flannel: "3",
    gateway_server: `${gatewayTeamId}-${shard}`,
    lazy_channels: "1",
    no_query_on_subscribe: "1",
    slack_client: "desktop",
    start_args: `?agent=client&org_wide_aware=true&agent_version=${Date.now()}&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true`,
    sync_desync: "1",
    token: current.token,
  });
  return `wss://wss-primary.slack.com/?${params}`;
}

function scheduleGatewayReconnect(state: ConnectionState) {
  if (state.closed || state.gatewayRetryTimer) return;
  const delay = state.gatewayRetryDelay;
  state.gatewayRetryDelay = Math.min(delay * 2, GATEWAY_MAX_RETRY_DELAY);
  state.gatewayRetryTimer = setTimeout(() => {
    state.gatewayRetryTimer = null;
    connectGateway(state);
  }, delay);
}

function connectGateway(state: ConnectionState) {
  if (state.closed || state.gatewaySocket) return;
  try {
    const socket = new WebSocket(buildGatewayUrl(state.creds), {
      headers: { cookie: slackCookieHeader(state.creds) },
    });
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      state.gatewayConnected = true;
      state.gatewayRetryDelay = 2000;
      stopFallbackPolling(state);
      sendStatus(state);
    });

    socket.addEventListener("message", (event) => {
      if (state.gatewaySocket !== socket) return;
      try {
        const payload = JSON.parse(String(event.data));
        if (payload?.type === "presence_change" && payload.presence === "active") {
          const teamId = teamIdFromRoute(state.creds.route);
          if (teamId) {
            const ids: string[] = payload.users ?? (payload.user ? [payload.user] : []);
            for (const id of ids) recordSeenActive(teamId, id);
          }
        }
        const trimmed = trimSlackGatewayPayload(payload);
        if (trimmed) send(state, rewriteSlackAssetUrls(trimmed, state.creds));
      } catch {}
    });

    const onDown = () => {
      if (state.gatewaySocket !== socket) return;
      state.gatewaySocket = null;
      state.gatewayConnected = false;
      sendStatus(state);
      if (state.closed) return;
      if (socket.readyState !== WebSocket.CLOSED) socket.close();
      scheduleGatewayReconnect(state);
    };
    socket.addEventListener("close", onDown);
    socket.addEventListener("error", onDown);

    const pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ id: Date.now(), type: "ping" }));
      } catch {
        clearInterval(pingTimer);
      }
    }, 30000);
    socket.addEventListener("close", () => clearInterval(pingTimer));
  } catch {
    if (state.closed) return;
    scheduleGatewayReconnect(state);
  }
}

export function handleClientOpen(socket: ClientSocket, creds: Credentials | null): void {
  if (!creds) return;
  const state: ConnectionState = {
    closed: false,
    creds,
    fallbackTimer: null,
    fallbackPollRunning: false,
    gatewayConnected: false,
    gatewayRetryDelay: 2000,
    gatewayRetryTimer: null,
    gatewaySocket: null,
    socket,
    watchedChannels: new Set(),
    watchedThreads: new Map(),
  };
  connections.set(socket, state);
  connectGateway(state);
}

export function handleClientDisconnect(socket: ClientSocket): void {
  const state = connections.get(socket);
  if (!state) return;
  state.closed = true;
  state.gatewaySocket?.close();
  if (state.gatewayRetryTimer) clearTimeout(state.gatewayRetryTimer);
  state.gatewayRetryTimer = null;
  stopFallbackPolling(state);
  connections.delete(socket);
}

export function handleClientMessage(raw: string, socket: ClientSocket): void {
  const state = connections.get(socket);
  if (!state) return;
  try {
    const msg = JSON.parse(raw);
    if (msg.type === "watch_channel" && msg.channel) state.watchedChannels.add(msg.channel);
    else if (msg.type === "unwatch_channel" && msg.channel)
      state.watchedChannels.delete(msg.channel);
    else if (msg.type === "watch_thread" && msg.channel && msg.ts)
      state.watchedThreads.set(msg.ts, msg.channel);
    else if (msg.type === "unwatch_thread" && msg.ts) state.watchedThreads.delete(msg.ts);
  } catch {}
}
