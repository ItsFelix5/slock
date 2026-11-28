import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChannelId } from "@slock/types";
import { createRoot, flush } from "solid-js";
import { createRealtime } from "../../../../../packages/plugins/src/realtime/client/realtime";
import { createFakeEnv, type FakeEnv } from "../../../../support/core";
import { ch } from "../../../../support/slack";
import { installFakeBrowser } from "../../../realtime/support/fakeBrowser";
import { installFakeWebSocket } from "../../../realtime/support/fakeWebSocket";
import { createStoreHarness, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");
const TEN_MINUTES = 10 * 60_000;

let env: FakeEnv;
let browser: ReturnType<typeof installFakeBrowser>;
let sockets: ReturnType<typeof installFakeWebSocket>;
let h: StoreHarness;
let stopRealtime: () => void;
let originalLocation: PropertyDescriptor | undefined;

const texts = (channel: ChannelId) => h.messages(channel).map((m) => m.text);

function acceptGateway() {
  sockets.last().accept();
  sockets.last().receive({ connected: false, type: "_status" });
  sockets.last().receive({ connected: true, type: "_status" });
  flush();
}

beforeEach(async () => {
  env = createFakeEnv();
  browser = installFakeBrowser({ online: true });
  Object.assign(document, { cookie: "" });
  sockets = installFakeWebSocket();
  originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { host: "test", protocol: "http:" },
  });
  h = await createStoreHarness(env);
  h.open(C1);
  await settle();
  h.slack.say(C1, OTHER, "before the sleep");
  await h.store.loadRecentHistory(C1);
  stopRealtime = createRoot((dispose) => {
    createRealtime({
      env,
      handlers: () => h.handlers,
      onOpen: () => [],
      onReconnect: () => [h.onReconnect],
    });
    return dispose;
  });
  flush();
  acceptGateway();
});

afterEach(() => {
  stopRealtime();
  h.dispose();
  sockets.restore();
  browser.restore();
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
});

describe("after the machine sleeps", () => {
  test("a message posted during the sleep shows up once the socket is back", async () => {
    env.sleep(TEN_MINUTES);
    h.slack.say(C1, OTHER, "posted while asleep");
    env.advance(20_000);
    expect(sockets.sockets).toHaveLength(2);
    acceptGateway();
    await settle();
    expect(texts(C1)).toEqual(["before the sleep", "posted while asleep"]);
  });
});
