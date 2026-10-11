import { defined } from "@slock/core";
import { rewriteSlackAssetUrls } from "../../slack/server/api/assets";
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
  closed: boolean;
};

const GATEWAY_MAX_RETRY_DELAY = 60000;
const GATEWAY_RETRY_DELAY = 2000;
const PING_INTERVAL_MS = 30000;

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
  const delay = state.gatewayRetryDelay;
  state.gatewayRetryDelay = Math.min(delay * 2, GATEWAY_MAX_RETRY_DELAY);
  state.gatewayRetryTimer = setTimeout(() => {
    state.gatewayRetryTimer = null;
    connectGateway(state);
  }, delay);
}

function forward(state: ConnectionState, event: GatewayEvent) {
  for (const hook of state.hooks()) {
    if (hook.types.includes(event.type)) hook.handle(event, state.creds);
  }
  const custom = state.trims().find((entry) => entry.types.includes(event.type));
  const trimmed = custom ? custom.trim(event, state.creds) : trimSlackGatewayPayload(event);
  if (trimmed) send(state, rewriteSlackAssetUrls(trimmed, state.creds));
}

function connectGateway(state: ConnectionState) {
  if (state.closed || state.gatewaySocket) return;
  try {
    const socket = new WebSocket(buildGatewayUrl(state.creds), {
      headers: { cookie: `d=${state.creds.slackSession}` },
    });
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      state.gatewayConnected = true;
      state.gatewayRetryDelay = GATEWAY_RETRY_DELAY;
      send(state, { connected: true, type: "_status" });
      sendPresenceSub(state);
    });

    socket.addEventListener("message", (event) => {
      if (state.gatewaySocket !== socket) return;
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

    const pingTimer = setInterval(() => {
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
      state.gatewaySocket?.close();
      if (state.gatewayRetryTimer) clearTimeout(state.gatewayRetryTimer);
      state.gatewayRetryTimer = null;
      connections.delete(socket);
    },
    message(socket: ClientSocket, raw: string) {
      const state = connections.get(socket);
      if (!state) return;
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "watch_presence" && Array.isArray(msg.ids)) {
          state.presenceSubIds = new Set(msg.ids.filter((id: unknown) => typeof id === "string"));
          sendPresenceSub(state);
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
        presenceSubIds: new Set(),
        socket,
        trims,
      };
      connections.set(socket, state);
      connectGateway(state);
    },
  };
}
