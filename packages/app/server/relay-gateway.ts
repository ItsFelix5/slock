// biome-ignore-all lint/style/useNamingConvention: Gateway query parameters use Slack's wire field names.
import { type Credentials, callSlack, slackCookieHeader } from "./relay-core.js";

export type ClientSocket = { send(data: string): void };

type ConnectionState = {
  creds: Credentials;
  socket: ClientSocket;
  gatewaySocket: WebSocket | null;
  gatewayConnected: boolean;
  gatewayRetryDelay: number;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  watchedChannels: Set<string>;
  watchedThreads: Map<string, string>;
  closed: boolean;
};

const connections = new WeakMap<ClientSocket, ConnectionState>();
const GATEWAY_MAX_RETRY_DELAY = 60000;

function send(state: ConnectionState, payload: unknown) {
  try {
    state.socket.send(JSON.stringify(payload));
  } catch {
    // dropped client; the close handler will clean it up
  }
}

function sendStatus(state: ConnectionState) {
  send(state, { connected: state.gatewayConnected, type: "_status" });
}

export function statusMessage(connected: boolean): string {
  return JSON.stringify({ connected, type: "_status" });
}

function startFallbackPolling(state: ConnectionState) {
  if (state.fallbackTimer) return;
  state.fallbackTimer = setInterval(async () => {
    for (const channel of state.watchedChannels) {
      try {
        const data = await callSlack(
          "conversations.history",
          { channel, limit: "60" },
          state.creds,
        );
        if (data.ok)
          send(state, { channel, messages: data.messages ?? [], type: "_history_snapshot" });
      } catch {
        // transient network error; next tick retries
      }
    }
    for (const [ts, channel] of state.watchedThreads) {
      try {
        const data = await callSlack(
          "conversations.replies",
          { channel, limit: "200", ts },
          state.creds,
        );
        if (data.ok)
          send(state, { channel, messages: data.messages ?? [], ts, type: "_replies_snapshot" });
      } catch {
        // transient network error; next tick retries
      }
    }
  }, 4000);
}

function stopFallbackPolling(state: ConnectionState) {
  if (state.fallbackTimer) {
    clearInterval(state.fallbackTimer);
    state.fallbackTimer = null;
  }
}

function buildGatewayUrl(current: Credentials) {
  const [enterpriseId] = current.route.split(":");
  const gatewayTeamId = `T${enterpriseId.slice(1)}`;
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

function connectGateway(state: ConnectionState) {
  if (state.closed) return;
  try {
    const socket = new WebSocket(buildGatewayUrl(state.creds), {
      headers: { cookie: slackCookieHeader(state.creds) },
    });
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      console.log("Connected to Slack Edge gateway");
      state.gatewayConnected = true;
      state.gatewayRetryDelay = 2000;
      stopFallbackPolling(state);
      sendStatus(state);
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== "pong" && payload.type !== "reconnect_url")
          send(state, payload);
      } catch {
        // ignore malformed frames
      }
    });

    const onDown = () => {
      if (state.gatewaySocket !== socket) return;
      state.gatewaySocket = null;
      state.gatewayConnected = false;
      sendStatus(state);
      if (state.closed) return;
      startFallbackPolling(state);
      setTimeout(() => connectGateway(state), state.gatewayRetryDelay);
      state.gatewayRetryDelay = Math.min(state.gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
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
  } catch (err) {
    console.warn("Failed to connect to Slack gateway, retrying:", err);
    if (state.closed) return;
    startFallbackPolling(state);
    setTimeout(() => connectGateway(state), state.gatewayRetryDelay);
    state.gatewayRetryDelay = Math.min(state.gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  }
}

export function handleClientOpen(socket: ClientSocket, creds: Credentials | null): void {
  if (!creds) return;
  const state: ConnectionState = {
    closed: false,
    creds,
    fallbackTimer: null,
    gatewayConnected: false,
    gatewayRetryDelay: 2000,
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
  } catch {
    // ignore malformed client frames
  }
}
