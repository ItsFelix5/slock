import type { GatewayEvent } from "@slock/types";
import { batch } from "solid-js";
import type { RealtimeHandler } from "./api";
import { createRealtimeConnection } from "./connection/realtimeConnection";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function indexByType(handlers: RealtimeHandler[]) {
  const byType = new Map<string, RealtimeHandler[]>();
  for (const handler of handlers) {
    for (const type of handler.types) {
      const list = byType.get(type);
      if (list) list.push(handler);
      else byType.set(type, [handler]);
    }
  }
  return byType;
}

export function createRealtime(points: {
  handlers: () => RealtimeHandler[];
  onOpen: () => (() => void)[];
  onReconnect: () => ((info: { downMs: number }) => void)[];
}) {
  let indexedFrom: RealtimeHandler[] | undefined;
  let byType = new Map<string, RealtimeHandler[]>();
  const handlersFor = (type: string) => {
    const handlers = points.handlers();
    if (handlers !== indexedFrom) {
      indexedFrom = handlers;
      byType = indexByType(handlers);
    }
    return byType.get(type) ?? [];
  };

  function dispatch(raw: string) {
    let event: GatewayEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (event.type === "_status") connection.setGatewayConnected(!!event.connected);
    for (const handler of handlersFor(event.type)) handler.run(event);
  }

  let queue: string[] = [];
  function handleRaw(raw: string) {
    queue.push(raw);
    if (queue.length > 1) return;
    queueMicrotask(() => {
      const frames = queue;
      queue = [];
      batch(() => {
        for (const frame of frames) dispatch(frame);
      });
    });
  }

  const connection = createRealtimeConnection({
    onMessage: handleRaw,
    onOpen: () => {
      for (const run of points.onOpen()) run();
    },
    onReconnect: (downMs) => {
      for (const run of points.onReconnect()) run({ downMs });
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
