import type { Setup } from "@slock/core";
import { UPGRADED } from "@slock/server/http";
import { createGateway } from "./gateway";

const setup: Setup = (ctx) => {
  const gateway = createGateway(ctx.use("realtime.event"), ctx.use("realtime.trim"));
  ctx.add(
    "http",
    (c, next) => {
      if (c.url.pathname !== "/ws") return next();
      return c.upgrade({ creds: c.creds ?? null })
        ? UPGRADED
        : new Response("upgrade failed", { status: 400 });
    },
    { order: 800 },
  );
  ctx.add("ws", {
    close: (ws) => gateway.close(ws),
    message: (ws, message) => gateway.message(ws, String(message)),
    open: (ws) => gateway.open(ws, ws.data.creds),
  });
};

export default setup;
