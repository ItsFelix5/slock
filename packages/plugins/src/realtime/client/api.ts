import type { GatewayEvent } from "@slock/types";
import type { createRealtime } from "./realtime";

export type RealtimeHandler = {
  types: readonly string[];
  run(event: GatewayEvent): void;
};

export function gatewayHandler<T extends GatewayEvent["type"]>(
  types: readonly T[],
  run: (event: Extract<GatewayEvent, { type: T }>) => void,
): RealtimeHandler {
  const matches = (event: GatewayEvent): event is Extract<GatewayEvent, { type: T }> =>
    types.some((type) => type === event.type);
  return {
    run: (event) => {
      if (matches(event)) run(event);
    },
    types,
  };
}

declare module "@slock/core/types" {
  interface Points {
    "realtime.handler": RealtimeHandler;
    "realtime.open": () => void;
    "realtime.reconnect": () => void;
  }
  interface Services {
    realtime: ReturnType<typeof createRealtime>;
  }
}
