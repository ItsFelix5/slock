import { createRoot } from "solid-js";
import { createRealtimeConnection } from "../client/connection/realtimeConnection";
import { installFakeBrowser } from "./fakeBrowser";
import { installFakeWebSocket } from "./fakeWebSocket";

export function createConnectionHarness(opts: { online?: boolean } = {}) {
  const browser = installFakeBrowser({ online: opts.online ?? true });
  const sockets = installFakeWebSocket();
  const log: string[] = [];
  let dispose = () => {};
  return {
    browser,
    log,
    restore() {
      dispose();
      sockets.restore();
      browser.restore();
    },
    sockets,
    start() {
      const started = createRoot((disposeRoot) => ({
        connection: createRealtimeConnection({
          onMessage: (raw) => void log.push(`message:${raw}`),
          onOpen: () => void log.push("open"),
          onReconnect: () => void log.push("reconnect"),
          url: () => "ws://test/ws",
        }),
        dispose: disposeRoot,
      }));
      ({ dispose } = started);
      return started;
    },
  };
}
