import { afterEach, beforeEach, expect, test } from "bun:test";
import { parseFileId } from "@slock/slack";
import { createRoot, flush } from "solid-js";
import { createRealtime } from "../../../../packages/plugins/src/realtime/client/realtime";
import { createFakeEnv } from "../../../support/core";
import { installFakeBrowser } from "../support/fakeBrowser";
import { installFakeWebSocket } from "../support/fakeWebSocket";

let browser: ReturnType<typeof installFakeBrowser>;
let sockets: ReturnType<typeof installFakeWebSocket>;
let originalLocation: PropertyDescriptor | undefined;
let stop: () => void;
let realtime: ReturnType<typeof createRealtime>;

const first = parseFileId("F1");
const second = parseFileId("F2");
const watched = () => sockets.last().sentJson().at(-1);

beforeEach(() => {
  browser = installFakeBrowser({ online: true });
  sockets = installFakeWebSocket();
  originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { host: "test", protocol: "http:" },
  });
  stop = createRoot((dispose) => {
    realtime = createRealtime({
      env: createFakeEnv(),
      handlers: () => [],
      onOpen: () => [],
      onReconnect: () => [],
    });
    return dispose;
  });
  flush();
});

afterEach(() => {
  stop();
  sockets.restore();
  browser.restore();
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
});

test("a file stays watched until its last watcher leaves", () => {
  sockets.last().accept();
  const closeOne = realtime.watchFile(first);
  const closeTwin = realtime.watchFile(first);
  realtime.watchFile(second);

  closeOne();
  expect(watched()).toEqual({ ids: [first, second], type: "watch_files" });

  closeTwin();
  expect(watched()).toEqual({ ids: [second], type: "watch_files" });
});

test("files watched before the socket opens are sent once it does", () => {
  realtime.watchFile(first);
  expect(sockets.last().sent).toHaveLength(0);

  sockets.last().accept();

  expect(watched()).toEqual({ ids: [first], type: "watch_files" });
});
