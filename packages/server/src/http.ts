import type { InstanceService } from "./instance.ts";

export interface WsData {
  [key: string]: unknown;
}

export type WsHandlers = {
  open?(ws: Bun.ServerWebSocket<WsData>): void;
  message?(ws: Bun.ServerWebSocket<WsData>, message: string | Buffer): void;
  close?(ws: Bun.ServerWebSocket<WsData>): void;
};

declare module "@slock/core/http" {
  interface HttpContext {
    upgrade(data: WsData): boolean;
  }
}

declare module "@slock/core/types" {
  interface Services {
    instance: InstanceService;
  }

  interface Points {
    ws: WsHandlers;
  }
}

export const UPGRADED = new Response(null, { status: 101 });
