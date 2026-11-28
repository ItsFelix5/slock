import type { Setup } from "@slock/core";
import { createRealtime } from "./realtime";
import ConnectionStatus from "./views/ConnectionStatus";

const setup: Setup = (ctx) => {
  const realtime = createRealtime({
    env: ctx.get("env"),
    handlers: ctx.use("realtime.handler"),
    onOpen: ctx.use("realtime.open"),
    onReconnect: ctx.use("realtime.reconnect"),
  });
  ctx.provide("realtime", realtime);
  ctx.add("shell.overlay", () => (
    <ConnectionStatus onRetry={realtime.retryConnection} state={realtime.connectionState()} />
  ));
};

export default setup;
