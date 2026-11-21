import { createHost, type HttpContext, type PluginDef, runHttp } from "@slock/core";
import { setHost } from "@slock/core/services";
import { UPGRADED, type WsData } from "./http.ts";
import { createInstance, type UnitInfo } from "./instance.ts";

export type { InstanceService, UnitInfo } from "./instance.ts";

export type ServerOptions = {
  plugins: PluginDef[];
  units: UnitInfo[];
  dataDir: string;
  clientDir?: string;
  dev?: boolean;
};

const DEFAULT_PORT = 5175;

export async function startServer(options: ServerOptions): Promise<void> {
  const port = Number(Bun.env.SLOCK_PORT) || DEFAULT_PORT;
  const host = createHost();
  setHost(host);
  const instance = createInstance({ ...options, dev: options.dev === true });
  await host.register({ id: "instance", setup: (ctx) => ctx.provide("instance", instance) });
  await host.register(...options.plugins);
  for (const { id, status } of host.list()) {
    if (status.state === "failed" || status.state === "blocked")
      console.error(`plugin ${id} ${status.state}: ${status.error}`);
  }

  Bun.serve<WsData>({
    async fetch(req, server) {
      const c: HttpContext = {
        req,
        upgrade: (data) => server.upgrade(req, { data }),
        url: new URL(req.url),
      };
      const res = await runHttp(host.items("http"), c);
      return res === UPGRADED ? undefined : res;
    },
    hostname: "0.0.0.0",
    port,
    websocket: {
      close(ws) {
        for (const handlers of host.items("ws")) handlers.close?.(ws);
      },
      message(ws, message) {
        for (const handlers of host.items("ws")) handlers.message?.(ws, message);
      },
      open(ws) {
        for (const handlers of host.items("ws")) handlers.open?.(ws);
      },
    },
  });

  console.log(`(${instance.dev ? "dev" : "production"}): http://localhost:${port}`);
}
