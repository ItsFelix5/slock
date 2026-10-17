import { createHost, type HttpContext, runHttp } from "@slock/core";
import { UPGRADED, type WsData } from "./http.ts";
import { discoverServerPlugins } from "./plugins.ts";

const PORT = Number(Bun.env.PORT) || 5175;
const DEV = Bun.argv.includes("--dev");
const disabled = (Bun.env.SLOCK_DISABLE ?? "").split(",").filter(Boolean);

const host = createHost({
  enabled: {
    read: () => Object.fromEntries(disabled.map((id) => [id, false])),
    write: () => {},
  },
});
for (const plugin of await discoverServerPlugins()) await host.register(plugin);
for (const { id, status } of host.list()) {
  if (status.state === "failed" || status.state === "blocked")
    console.error(`plugin ${id} ${status.state}: ${status.error}`);
}

for (const command of host.items("cli")) {
  if (!Bun.argv.includes(command.flag)) continue;
  await command.run(Bun.argv.slice(Bun.argv.indexOf(command.flag) + 1));
  process.exit();
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
  port: PORT,
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

const url = `http://localhost:${PORT}`;
console.log(`(${DEV ? "dev" : "production"}): ${url}`);
for (const started of host.items("server.started")) await started({ url });
