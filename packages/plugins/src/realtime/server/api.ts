import type { Credentials } from "../../slack/server/api/auth";

export type GatewayEvent = { type: string; [key: string]: unknown };

export type RealtimeEventHook = {
  types: readonly string[];
  handle(event: GatewayEvent, creds: Credentials): void;
};

export type RealtimeTrim = {
  types: readonly string[];
  trim(event: GatewayEvent, creds: Credentials): GatewayEvent | null;
};

declare module "@slock/core/types" {
  interface Points {
    "realtime.event": RealtimeEventHook;
    "realtime.trim": RealtimeTrim;
  }
}
