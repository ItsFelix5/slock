import { createSignal, onCleanup } from "solid-js";
import { createReconnectScheduler } from "./reconnectScheduler";

export type RealtimeConnectionState = "connected" | "connecting" | "offline" | "reconnecting";

export function createRealtimeConnection(opts: {
  onMessage: (raw: string) => void;
  onOpen: () => void;
  url: () => string;
}) {
  const online = () => navigator.onLine;
  const [connectionState, setConnectionState] = createSignal<RealtimeConnectionState>(
    online() ? "connecting" : "offline",
  );
  const [rtmConnected, setRtmConnected] = createSignal(false);
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
      setConnectionState("reconnecting");
      scheduler.schedule();
      return;
    }
    socket = current;
    current.addEventListener("open", () => {
      if (socket !== current) return;
      scheduler.connected();
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      opts.onOpen();
    });
    current.addEventListener("message", (event) => {
      if (socket === current) opts.onMessage(String(event.data));
    });
    current.addEventListener("close", () => {
      if (socket !== current) return;
      socket = null;
      setRtmConnected(false);
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
    setRtmConnected(false);
    setConnectionState("offline");
  };
  const handleOnline = () => {
    if (!online()) return;
    disconnectCurrent();
    setRtmConnected(false);
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
  });

  return {
    connectionState,
    retry() {
      if (!online()) {
        setConnectionState("offline");
        return;
      }
      disconnectCurrent();
      setRtmConnected(false);
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      scheduler.reconnectNow();
    },
    rtmConnected,
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
      setRtmConnected(connected);
      if (connected) hasConnected = true;
      setConnectionState(connected ? "connected" : online() ? "reconnecting" : "offline");
    },
  };
}
