import { createFakeEnv } from "@slock/core/testing";
import { createRoot, flush } from "solid-js";
import { createRealtimeConnection } from "../../../src/realtime/client/connection/realtimeConnection";
import { installFakeBrowser } from "./fakeBrowser";
import { installFakeWebSocket } from "./fakeWebSocket";

type Connection = ReturnType<typeof createRealtimeConnection>;

function settled(connection: Connection) {
  const read =
    <T>(signal: () => T) =>
    () => {
      flush();
      return signal();
    };
  return {
    ...connection,
    connectionState: read(connection.connectionState),
    gatewayConnected: read(connection.gatewayConnected),
    isSelfOnline: read(connection.isSelfOnline),
    setGatewayConnected(connected: boolean) {
      connection.setGatewayConnected(connected);
      flush();
    },
  };
}

export function createConnectionHarness(opts: { online?: boolean } = {}) {
  const browser = installFakeBrowser({ online: opts.online ?? true });
  const sockets = installFakeWebSocket();
  const fakeEnv = createFakeEnv();
  const env = {
    ...fakeEnv,
    advance(ms: number) {
      flush();
      fakeEnv.advance(ms);
      flush();
    },
    random: () => 0.5,
  };
  const log: string[] = [];
  let dispose = () => {};
  return {
    browser,
    env,
    log,
    restore() {
      dispose();
      sockets.restore();
      browser.restore();
    },
    sockets,
    start() {
      const started = createRoot((disposeRoot) => ({
        connection: settled(
          createRealtimeConnection({
            env,
            onMessage: (raw) => void log.push(`message:${raw}`),
            onOpen: () => void log.push("open"),
            onReconnect: () => void log.push("reconnect"),
            url: () => "ws://test/ws",
          }),
        ),
        dispose: disposeRoot,
      }));
      ({ dispose } = started);
      flush();
      return started;
    },
  };
}
