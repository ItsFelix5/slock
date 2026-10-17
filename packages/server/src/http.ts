export interface WsData {
  [key: string]: unknown;
}

export type WsHandlers = {
  open?(ws: Bun.ServerWebSocket<WsData>): void;
  message?(ws: Bun.ServerWebSocket<WsData>, message: string | Buffer): void;
  close?(ws: Bun.ServerWebSocket<WsData>): void;
};

export type ServerStarted = (info: { url: string }) => void | Promise<void>;

export type CliCommand = { flag: string; run(args: string[]): Promise<void> };

declare module "@slock/core/http" {
  interface HttpContext {
    upgrade(data: WsData): boolean;
  }
}

declare module "@slock/core/types" {
  interface Points {
    ws: WsHandlers;
    cli: CliCommand;
    "server.started": ServerStarted;
  }
}

export const UPGRADED = new Response(null, { status: 101 });
