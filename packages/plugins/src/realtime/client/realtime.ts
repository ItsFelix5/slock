import type { GatewayEvent } from "@slock/types";
import type { RealtimeHandler } from "./api";
import { createRealtimeConnection } from "./connection/realtimeConnection";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export function createRealtime(points: {
  handlers: () => RealtimeHandler[];
  onOpen: () => (() => void)[];
  onReconnect: () => (() => void)[];
}) {
  function handleRaw(raw: string) {
    let event: GatewayEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (event.type === "_status") connection.setGatewayConnected(!!event.connected);
    for (const handler of points.handlers()) {
      if (handler.types.includes(event.type)) handler.run(event);
    }
  }

  const connection = createRealtimeConnection({
    onMessage: handleRaw,
    onOpen: () => {
      for (const run of points.onOpen()) run();
    },
    onReconnect: () => {
      for (const run of points.onReconnect()) run();
    },
    url: wsUrl,
  });

  return {
    connectionState: connection.connectionState,
    gatewayConnected: connection.gatewayConnected,
    isSelfOnline: connection.isSelfOnline,
    retryConnection: connection.retry,
    send: connection.send,
  };
}
