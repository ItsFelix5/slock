import type { Env } from "@slock/core";
import type { FileId, GatewayEvent } from "@slock/types";
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
  env: Env;
  handlers: () => RealtimeHandler[];
  onOpen: () => (() => void)[];
  onReconnect: () => (() => void)[];
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

  const watchedFiles = new Map<FileId, number>();
  const sendWatchedFiles = () =>
    connection.send({ ids: [...watchedFiles.keys()], type: "watch_files" });

  function countWatchers(fileId: FileId, change: 1 | -1) {
    const count = (watchedFiles.get(fileId) ?? 0) + change;
    if (count) watchedFiles.set(fileId, count);
    else watchedFiles.delete(fileId);
    sendWatchedFiles();
  }

  function dispatch(raw: string) {
    const event: GatewayEvent = JSON.parse(raw);
    if (event.type === "_status") connection.setGatewayConnected(!!event.connected);
    for (const handler of handlersFor(event.type)) {
      try {
        handler.run(event);
      } catch (error) {
        console.error(`realtime handler failed for ${event.type}`, error);
      }
    }
  }

  const connection = createRealtimeConnection({
    env: points.env,
    onMessage: dispatch,
    onOpen: () => {
      sendWatchedFiles();
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
    watchFile(fileId: FileId) {
      countWatchers(fileId, 1);
      return () => countWatchers(fileId, -1);
    },
  };
}
