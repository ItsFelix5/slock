import type { Env, TimerHandle } from "@slock/core";
import { createEffect, createSignal, onCleanup, onSettled } from "solid-js";
import { createHeartbeat } from "./heartbeat";
import { createReconnectScheduler } from "./reconnectScheduler";

export type RealtimeConnectionState = "connected" | "connecting" | "offline" | "reconnecting";

const ONLINE_GRACE_MS = 45_000;
const STALE_HIDDEN_MS = 30_000;

export function createRealtimeConnection(opts: {
  env: Env;
  onMessage: (raw: string) => void;
  onOpen: () => void;
  onReconnect: (downMs: number) => void;
  url: () => string;
}) {
  const online = () => navigator.onLine;
  const [connectionState, setConnectionState] = createSignal<RealtimeConnectionState>(
    online() ? "connecting" : "offline",
  );
  const [gatewayConnected, setGatewayConnectedSignal] = createSignal(false);
  let gatewayUp = false;
  let disconnectedAt = opts.env.now();
  const writeGatewayConnected = (connected: boolean) => {
    if (!connected && gatewayUp) disconnectedAt = opts.env.now();
    gatewayUp = connected;
    setGatewayConnectedSignal(connected);
  };
  const isTrulyOnline = () => online() && gatewayConnected();
  const [recentlyOnline, setRecentlyOnline] = createSignal(online());
  let onlineGraceTimer: TimerHandle | undefined;
  createEffect(isTrulyOnline, (trulyOnline) => {
    if (trulyOnline) {
      opts.env.clearTimeout(onlineGraceTimer);
      onlineGraceTimer = undefined;
      setRecentlyOnline(true);
    } else if (!onlineGraceTimer) {
      onlineGraceTimer = opts.env.setTimeout(() => {
        onlineGraceTimer = undefined;
        setRecentlyOnline(false);
      }, ONLINE_GRACE_MS);
    }
  });
  let disposed = false;
  let hasConnected = false;
  let socket: WebSocket | null = null;

  const scheduler = createReconnectScheduler({ connect, env: opts.env, isOnline: online });
  const heartbeat = createHeartbeat({
    env: opts.env,
    onDead: restart,
    ping: () => send({ type: "ping" }),
  });

  function connect() {
    if (disposed || !online() || socket) return;
    setConnectionState(hasConnected ? "reconnecting" : "connecting");
    let current: WebSocket;
    try {
      current = new WebSocket(opts.url());
    } catch {
      setConnectionState("reconnecting");
      scheduler.schedule();
      return;
    }
    socket = current;
    heartbeat.start();
    current.addEventListener("open", () => {
      if (socket !== current) return;
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      opts.onOpen();
    });
    current.addEventListener("message", (event) => {
      if (socket !== current) return;
      heartbeat.heard();
      opts.onMessage(String(event.data));
    });
    current.addEventListener("close", () => {
      if (socket !== current) return;
      socket = null;
      heartbeat.stop();
      writeGatewayConnected(false);
      setConnectionState(online() ? "reconnecting" : "offline");
      scheduler.schedule();
    });
    current.addEventListener("error", () => current.close());
  }

  const disconnectCurrent = () => {
    const current = socket;
    socket = null;
    heartbeat.stop();
    current?.close();
  };
  function restart() {
    disconnectCurrent();
    writeGatewayConnected(false);
    setConnectionState(hasConnected ? "reconnecting" : "connecting");
    scheduler.reconnectNow();
  }
  function send(payload: unknown) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      socket.close();
      return false;
    }
  }
  const handleOffline = () => {
    scheduler.pause();
    disconnectCurrent();
    writeGatewayConnected(false);
    setConnectionState("offline");
  };
  const handleOnline = () => {
    if (online()) restart();
  };
  let hiddenAt: number | null = null;
  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = opts.env.now();
      return;
    }
    const wasStale = hiddenAt !== null && opts.env.now() - hiddenAt > STALE_HIDDEN_MS;
    hiddenAt = null;
    if (!online()) return;
    if (wasStale) restart();
    else if (!socket) scheduler.reconnectNow();
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);
  onSettled(connect);

  onCleanup(() => {
    disposed = true;
    scheduler.dispose();
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
    disconnectCurrent();
    opts.env.clearTimeout(onlineGraceTimer);
  });

  return {
    connectionState,
    isSelfOnline: () => isTrulyOnline() || recentlyOnline(),
    retry() {
      if (!online()) {
        setConnectionState("offline");
        return;
      }
      restart();
    },
    gatewayConnected,
    send,
    setGatewayConnected(connected: boolean) {
      const wasConnected = hasConnected;
      writeGatewayConnected(connected);
      if (connected) {
        scheduler.connected();
        hasConnected = true;
        if (wasConnected) opts.onReconnect(opts.env.now() - disconnectedAt);
      }
      setConnectionState(connected ? "connected" : online() ? "reconnecting" : "offline");
    },
  };
}
