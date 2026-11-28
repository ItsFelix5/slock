import type { InstanceService } from "./instance";

export interface WsData {
  [key: string]: unknown;
}

type WsHandlers = {
  open?(ws: Bun.ServerWebSocket<WsData>): void;
  message?(ws: Bun.ServerWebSocket<WsData>, message: string | Buffer): void;
  close?(ws: Bun.ServerWebSocket<WsData>): void;
};

export interface HttpContext {
  req: Request;
  url: URL;
  upgrade(data: WsData): boolean;
}

export type HttpHandler = (
  c: HttpContext,
  next: () => Promise<Response | undefined>,
) => Response | undefined | Promise<Response | undefined>;

declare module "../types" {
  interface Services {
    instance: InstanceService;
  }

  interface Points {
    http: HttpHandler;
    ws: WsHandlers;
  }
}

export const UPGRADED = new Response(null, { status: 101 });

export function runHttp(
  handlers: readonly HttpHandler[],
  c: HttpContext,
): Promise<Response | undefined> {
  const outerFirst = handlers.toReversed();
  async function call(index: number): Promise<Response | undefined> {
    return await outerFirst[index]?.(c, () => call(index + 1));
  }
  return call(0);
}
