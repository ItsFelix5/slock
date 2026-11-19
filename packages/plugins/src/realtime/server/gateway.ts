import { backoff, defined, type Env, type TimerHandle } from "@slock/core";
import { type Credentials, teamIdFromRoute } from "../../slack/server/api/auth";
import type { GatewayEvent, RealtimeEventHook, RealtimeTrim } from "./api";
import { parseFrame } from "./frame";
import { trimSlackGatewayPayload } from "./trim";

export type ClientSocket = { send(data: string): void };

type ConnectionState = {
  creds: Credentials;
  socket: ClientSocket;
  hooks: () => RealtimeEventHook[];
  trims: () => RealtimeTrim[];
  gatewaySocket: WebSocket | null;
  gatewayAttempt: number;
  gatewayRetryTimer: TimerHandle | undefined;
  presenceSubIds: Set<string>;
  userChangeSubIds: Set<string>;
  lastHeardAt: number;
  closed: boolean;
};

const GATEWAY_MAX_RETRY_DELAY = 60000;
const GATEWAY_RETRY_DELAY = 2000;
const GATEWAY_RETRY_JITTER = 0.3;
const PING_INTERVAL_MS = 30000;
const GATEWAY_SILENCE_MS = 90000;
const SUBSCRIPTION_CHUNK = 100;
const SUBSCRIPTION_TOPICS = ["user_change", "dnd_invalidated"];

const PONG = JSON.stringify({ type: "pong" });

export function statusMessage(connected: boolean): string {
  return JSON.stringify({ connected, type: "_status" });
}

function send(state: ConnectionState, payload: unknown) {
  state.socket.send(JSON.stringify(payload));
}

function sendGateway(state: ConnectionState, payload: unknown) {
  if (state.gatewaySocket?.readyState !== WebSocket.OPEN) return;
  state.gatewaySocket.send(JSON.stringify(payload));
}

function sendPresenceSub(state: ConnectionState) {
  if (state.presenceSubIds.size === 0) return;
  sendGateway(state, { ids: [...state.presenceSubIds], type: "presence_sub" });
}

function sendUserChangeSubscriptions(state: ConnectionState) {
  if (state.gatewaySocket?.readyState !== WebSocket.OPEN) return;
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
        sendGateway(state, { ids: chunk, subtype, type: "subscription_update" });
      }
    }
  }
  state.userChangeSubIds = new Set(state.presenceSubIds);
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

export function createGateway(
  env: Env,
  hooks: () => RealtimeEventHook[],
  trims: () => RealtimeTrim[],
) {
  const connections = new WeakMap<ClientSocket, ConnectionState>();

  // rtm.connect fails with enterprise_is_restricted on Enterprise Grid, so we mirror the web client's gateway URL
  function buildGatewayUrl(current: Credentials) {
    const [enterpriseId] = current.route.split(":");
    const gatewayTeamId = teamIdFromRoute(current.route) ?? enterpriseId;
    const shard = 1 + Math.floor(env.random() * 3);
    const params = new URLSearchParams({
      batch_presence_aware: "1",
      enterprise_id: defined(enterpriseId),
      flannel: "3",
      gateway_server: `${gatewayTeamId}-${shard}`,
      lazy_channels: "1",
      no_query_on_subscribe: "1",
      slack_client: "desktop",
      start_args: `?agent=client&org_wide_aware=true&agent_version=${env.now()}&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true`,
      sync_desync: "1",
      token: current.token,
    });
    return `wss://wss-primary.slack.com/?${params}`;
  }

  function scheduleGatewayReconnect(state: ConnectionState) {
    if (state.closed || state.gatewayRetryTimer) return;
    const delay = backoff(state.gatewayAttempt++, {
      base: GATEWAY_RETRY_DELAY,
      jitter: GATEWAY_RETRY_JITTER,
      max: GATEWAY_MAX_RETRY_DELAY,
      random: env.random,
    });
    state.gatewayRetryTimer = env.setTimeout(() => {
      state.gatewayRetryTimer = undefined;
      connectGateway(state);
    }, delay);
  }

  function watchSilence(state: ConnectionState, socket: WebSocket, onDown: () => void) {
    const pingTimer = env.setInterval(() => {
      if (env.now() - state.lastHeardAt > GATEWAY_SILENCE_MS) {
        env.clearInterval(pingTimer);
        onDown();
        return;
      }
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ id: env.now(), type: "ping" }));
    }, PING_INTERVAL_MS);
    socket.addEventListener("close", () => env.clearInterval(pingTimer));
  }

  function connectGateway(state: ConnectionState) {
    if (state.closed || state.gatewaySocket) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(buildGatewayUrl(state.creds), {
        headers: { cookie: `d=${state.creds.slackSession}` },
      });
    } catch {
      scheduleGatewayReconnect(state);
      return;
    }
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      state.gatewayAttempt = 0;
      state.lastHeardAt = env.now();
      send(state, { connected: true, type: "_status" });
      state.userChangeSubIds = new Set();
      sendPresenceSub(state);
      sendUserChangeSubscriptions(state);
    });

    socket.addEventListener("message", (event) => {
      if (state.gatewaySocket !== socket) return;
      state.lastHeardAt = env.now();
      const frame = parseFrame(String(event.data));
      if (frame) forward(state, frame);
    });

    const onDown = () => {
      if (state.gatewaySocket !== socket) return;
      state.gatewaySocket = null;
      send(state, { connected: false, type: "_status" });
      if (state.closed) return;
      if (socket.readyState !== WebSocket.CLOSED) socket.close();
      scheduleGatewayReconnect(state);
    };
    socket.addEventListener("close", onDown);
    socket.addEventListener("error", onDown);

    state.lastHeardAt = env.now();
    watchSilence(state, socket, onDown);
  }

  function handleClientMessage(state: ConnectionState, msg: GatewayEvent) {
    if (msg.type === "watch_presence" && Array.isArray(msg.ids)) {
      state.presenceSubIds = new Set(msg.ids.filter((id) => typeof id === "string"));
      sendPresenceSub(state);
      sendUserChangeSubscriptions(state);
    }
    if (msg.type === "typing" && typeof msg.channel === "string") {
      sendGateway(state, {
        channel: msg.channel,
        id: env.now(),
        thread_ts: typeof msg.thread_ts === "string" ? msg.thread_ts : undefined,
        type: "typing",
      });
    }
    if (msg.type === "tickle") sendGateway(state, { reason: "focus", type: "tickle" });
  }

  return {
    close(socket: ClientSocket) {
      const state = connections.get(socket);
      if (!state) return;
      state.closed = true;
      const { gatewaySocket } = state;
      state.gatewaySocket = null;
      gatewaySocket?.close();
      env.clearTimeout(state.gatewayRetryTimer);
      state.gatewayRetryTimer = undefined;
      connections.delete(socket);
    },
    message(socket: ClientSocket, raw: string) {
      const msg = parseFrame(raw);
      if (!msg) return;
      if (msg.type === "ping") {
        socket.send(PONG);
        return;
      }
      const state = connections.get(socket);
      if (state) handleClientMessage(state, msg);
    },
    open(socket: ClientSocket, creds: Credentials | null) {
      socket.send(statusMessage(false));
      if (!creds) return;
      const state: ConnectionState = {
        closed: false,
        creds,
        gatewayAttempt: 0,
        gatewayRetryTimer: undefined,
        gatewaySocket: null,
        hooks,
        lastHeardAt: env.now(),
        presenceSubIds: new Set(),
        socket,
        trims,
        userChangeSubIds: new Set(),
      };
      connections.set(socket, state);
      connectGateway(state);
    },
  };
}
