import { createEffect, createSignal, onCleanup } from "solid-js";
import { createReconnectScheduler } from "./reconnectScheduler";

export type RealtimeConnectionState = "connected" | "connecting" | "offline" | "reconnecting";

const ONLINE_GRACE_MS = 45_000;

export function createRealtimeConnection(opts: {
  onMessage: (raw: string) => void;
  onOpen: () => void;
  onReconnect: () => void;
  url: () => string;
}) {
  const online = () => navigator.onLine;
  const [connectionState, setConnectionState] = createSignal<RealtimeConnectionState>(
    online() ? "connecting" : "offline",
  );
  const [gatewayConnected, writeGatewayConnected] = createSignal(false);
  const isTrulyOnline = () => online() && gatewayConnected();
  const [recentlyOnline, setRecentlyOnline] = createSignal(online());
  let onlineGraceTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    if (isTrulyOnline()) {
      if (onlineGraceTimer) {
        clearTimeout(onlineGraceTimer);
        onlineGraceTimer = null;
      }
      setRecentlyOnline(true);
    } else if (!onlineGraceTimer) {
      onlineGraceTimer = setTimeout(() => {
        onlineGraceTimer = null;
        setRecentlyOnline(false);
      }, ONLINE_GRACE_MS);
    }
  });
  let disposed = false;
  let hasConnected = false;
  let socket: WebSocket | null = null;

  const scheduler = createReconnectScheduler({ connect, isOnline: online });

  function connect() {
    if (disposed || !online() || socket) return;
    setConnectionState(hasConnected ? "reconnecting" : "connecting");
    let current: WebSocket;
    try {
      current = new WebSocket(opts.url());
    } catch {
      console.error("Failed to connect 3:");
      setConnectionState("reconnecting");
      scheduler.schedule();
      return;
    }
    socket = current;
    current.addEventListener("open", () => {
      if (socket !== current) return;
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      opts.onOpen();
    });
    current.addEventListener("message", (event) => {
      if (socket === current) opts.onMessage(String(event.data));
    });
    current.addEventListener("close", () => {
      if (socket !== current) return;
      socket = null;
      writeGatewayConnected(false);
      setConnectionState(online() ? "reconnecting" : "offline");
      scheduler.schedule();
    });
    current.addEventListener("error", () => current.close());
  }

  const disconnectCurrent = () => {
    const current = socket;
    socket = null;
    current?.close();
  };
  const handleOffline = () => {
    scheduler.pause();
    disconnectCurrent();
    writeGatewayConnected(false);
    setConnectionState("offline");
  };
  const handleOnline = () => {
    if (!online()) return;
    disconnectCurrent();
    writeGatewayConnected(false);
    setConnectionState(hasConnected ? "reconnecting" : "connecting");
    scheduler.reconnectNow();
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible" && !socket && online()) scheduler.reconnectNow();
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);
  connect();

  onCleanup(() => {
    disposed = true;
    scheduler.dispose();
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
    disconnectCurrent();
    if (onlineGraceTimer) clearTimeout(onlineGraceTimer);
  });

  return {
    connectionState,
    isSelfOnline: () => isTrulyOnline() || recentlyOnline(),
    retry() {
      if (!online()) {
        setConnectionState("offline");
        return;
      }
      disconnectCurrent();
      writeGatewayConnected(false);
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      scheduler.reconnectNow();
    },
    gatewayConnected,
    send(payload: unknown) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch {
        socket.close();
        return false;
      }
    },
    setGatewayConnected(connected: boolean) {
      const wasConnected = hasConnected;
      writeGatewayConnected(connected);
      if (connected) {
        scheduler.connected();
        hasConnected = true;
        if (wasConnected) opts.onReconnect();
      }
      setConnectionState(connected ? "connected" : online() ? "reconnecting" : "offline");
    },
  };
}
