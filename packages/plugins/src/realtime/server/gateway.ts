import { defined } from "@slock/core";
import { type Credentials, teamIdFromRoute } from "../../slack/server/api/auth";
import type { GatewayEvent, RealtimeEventHook, RealtimeTrim } from "./api";
import { trimSlackGatewayPayload } from "./trim";

export type ClientSocket = { send(data: string): void };

type ConnectionState = {
  creds: Credentials;
  socket: ClientSocket;
  hooks: () => RealtimeEventHook[];
  trims: () => RealtimeTrim[];
  gatewaySocket: WebSocket | null;
  gatewayConnected: boolean;
  gatewayRetryDelay: number;
  gatewayRetryTimer: ReturnType<typeof setTimeout> | null;
  presenceSubIds: Set<string>;
  userChangeSubIds: Set<string>;
  lastHeardAt: number;
  closed: boolean;
};

const GATEWAY_MAX_RETRY_DELAY = 60000;
const GATEWAY_RETRY_DELAY = 2000;
const PING_INTERVAL_MS = 30000;
const GATEWAY_SILENCE_MS = 90000;
const SUBSCRIPTION_CHUNK = 100;
const SUBSCRIPTION_TOPICS = ["user_change", "dnd_invalidated"];

type HeaderWebSocket = new (url: string, options: Bun.WebSocketOptions) => WebSocket;

const PONG = JSON.stringify({ type: "pong" });

export function statusMessage(connected: boolean): string {
  return JSON.stringify({ connected, type: "_status" });
}

function send(state: ConnectionState, payload: unknown) {
  try {
    state.socket.send(JSON.stringify(payload));
  } catch {}
}

function sendPresenceSub(state: ConnectionState) {
  if (state.presenceSubIds.size === 0) return;
  if (state.gatewaySocket?.readyState !== WebSocket.OPEN) return;
  state.gatewaySocket.send(
    JSON.stringify({ ids: [...state.presenceSubIds], type: "presence_sub" }),
  );
}

function sendUserChangeSubscriptions(state: ConnectionState) {
  const socket = state.gatewaySocket;
  if (socket?.readyState !== WebSocket.OPEN) return;
  const added = [...state.presenceSubIds].filter((id) => !state.userChangeSubIds.has(id));
  const removed = [...state.userChangeSubIds].filter((id) => !state.presenceSubIds.has(id));
  for (const topic of SUBSCRIPTION_TOPICS) {
    const requests = [
      { ids: added, subtype: `${topic}_subscribe_request` },
      { ids: removed, subtype: `${topic}_unsubscribe_request` },
    ];
    for (const { ids, subtype } of requests) {
      for (let start = 0; start < ids.length; start += SUBSCRIPTION_CHUNK) {
        const chunk = ids.slice(start, start + SUBSCRIPTION_CHUNK);
        socket.send(JSON.stringify({ ids: chunk, subtype, type: "subscription_update" }));
      }
    }
  }
  state.userChangeSubIds = new Set(state.presenceSubIds);
}

// rtm.connect fails with enterprise_is_restricted on Enterprise Grid, so we mirror the web client's gateway URL
function buildGatewayUrl(current: Credentials) {
  const [enterpriseId] = current.route.split(":");
  const gatewayTeamId = teamIdFromRoute(current.route) ?? enterpriseId;
  const shard = 1 + Math.floor(Math.random() * 3);
  const params = new URLSearchParams({
    batch_presence_aware: "1",
    enterprise_id: defined(enterpriseId),
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
  const delay = state.gatewayRetryDelay * (0.7 + Math.random() * 0.6);
  state.gatewayRetryDelay = Math.min(state.gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  state.gatewayRetryTimer = setTimeout(() => {
    state.gatewayRetryTimer = null;
    connectGateway(state);
  }, delay);
}

function forward(state: ConnectionState, event: GatewayEvent) {
  for (const hook of state.hooks()) {
    if (!hook.types.includes(event.type)) continue;
    try {
      hook.handle(event, state.creds);
    } catch (error) {
      console.error(`realtime hook failed for ${event.type}`, error);
    }
  }
  const custom = state.trims().find((entry) => entry.types.includes(event.type));
  const trimmed = custom ? custom.trim(event, state.creds) : trimSlackGatewayPayload(event);
  if (trimmed) send(state, trimmed);
}

function connectGateway(state: ConnectionState) {
  if (state.closed || state.gatewaySocket) return;
  try {
    const socket = new (WebSocket as unknown as HeaderWebSocket)(buildGatewayUrl(state.creds), {
      headers: { cookie: `d=${state.creds.slackSession}` },
    });
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      state.gatewayConnected = true;
      state.gatewayRetryDelay = GATEWAY_RETRY_DELAY;
      state.lastHeardAt = Date.now();
      send(state, { connected: true, type: "_status" });
      state.userChangeSubIds = new Set();
      sendPresenceSub(state);
      sendUserChangeSubscriptions(state);
    });

    socket.addEventListener("message", (event) => {
      if (state.gatewaySocket !== socket) return;
      state.lastHeardAt = Date.now();
      try {
        forward(state, JSON.parse(String(event.data)));
      } catch {}
    });

    const onDown = () => {
      if (state.gatewaySocket !== socket) return;
      state.gatewaySocket = null;
      state.gatewayConnected = false;
      send(state, { connected: false, type: "_status" });
      if (state.closed) return;
      if (socket.readyState !== WebSocket.CLOSED) socket.close();
      scheduleGatewayReconnect(state);
    };
    socket.addEventListener("close", onDown);
    socket.addEventListener("error", onDown);

    state.lastHeardAt = Date.now();
    const pingTimer = setInterval(() => {
      if (Date.now() - state.lastHeardAt > GATEWAY_SILENCE_MS) {
        clearInterval(pingTimer);
        onDown();
        return;
      }
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ id: Date.now(), type: "ping" }));
      } catch {
        clearInterval(pingTimer);
      }
    }, PING_INTERVAL_MS);
    socket.addEventListener("close", () => clearInterval(pingTimer));
  } catch {
    scheduleGatewayReconnect(state);
  }
}

export function createGateway(hooks: () => RealtimeEventHook[], trims: () => RealtimeTrim[]) {
  const connections = new WeakMap<ClientSocket, ConnectionState>();
  return {
    close(socket: ClientSocket) {
      const state = connections.get(socket);
      if (!state) return;
      state.closed = true;
      const { gatewaySocket } = state;
      state.gatewaySocket = null;
      gatewaySocket?.close();
      if (state.gatewayRetryTimer) clearTimeout(state.gatewayRetryTimer);
      state.gatewayRetryTimer = null;
      connections.delete(socket);
    },
    message(socket: ClientSocket, raw: string) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "ping") {
          socket.send(PONG);
          return;
        }
        const state = connections.get(socket);
        if (!state) return;
        if (msg.type === "watch_presence" && Array.isArray(msg.ids)) {
          state.presenceSubIds = new Set(msg.ids.filter((id: unknown) => typeof id === "string"));
          sendPresenceSub(state);
          sendUserChangeSubscriptions(state);
        }
        if (msg.type === "typing" && typeof msg.channel === "string") {
          state.gatewaySocket?.send(
            JSON.stringify({
              channel: msg.channel,
              id: Date.now(),
              thread_ts: typeof msg.thread_ts === "string" ? msg.thread_ts : undefined,
              type: "typing",
            }),
          );
        }
        if (msg.type === "tickle" && state.gatewaySocket?.readyState === WebSocket.OPEN) {
          state.gatewaySocket.send(JSON.stringify({ reason: "focus", type: "tickle" }));
        }
      } catch {}
    },
    open(socket: ClientSocket, creds: Credentials | null) {
      socket.send(statusMessage(false));
      if (!creds) return;
      const state: ConnectionState = {
        closed: false,
        creds,
        gatewayConnected: false,
        gatewayRetryDelay: GATEWAY_RETRY_DELAY,
        gatewayRetryTimer: null,
        gatewaySocket: null,
        hooks,
        lastHeardAt: Date.now(),
        presenceSubIds: new Set(),
        userChangeSubIds: new Set(),
        socket,
        trims,
      };
      connections.set(socket, state);
      connectGateway(state);
    },
  };
}
