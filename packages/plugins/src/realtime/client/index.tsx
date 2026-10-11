import type { Setup } from "@slock/core";
import { ConnectionStatus } from "@slock/ui";
import { createRealtime } from "./realtime";

const setup: Setup = (ctx) => {
  const realtime = createRealtime({
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
