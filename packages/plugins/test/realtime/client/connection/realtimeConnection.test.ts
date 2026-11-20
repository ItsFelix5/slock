import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createConnectionHarness } from "../../support/connectionHarness";

let harness: ReturnType<typeof createConnectionHarness>;

beforeEach(() => {
  harness = createConnectionHarness();
});

afterEach(() => {
  harness.restore();
});

describe("connecting", () => {
  test("opens a socket and reports connected only after the gateway says so", () => {
    const { connection } = harness.start();
    expect(harness.sockets.sockets).toHaveLength(1);
    expect(harness.sockets.last().url).toBe("ws://test/ws");
    expect(connection.connectionState()).toBe("connecting");
    harness.sockets.last().accept();
    expect(harness.log).toEqual(["open"]);
    expect(connection.connectionState()).toBe("connecting");
    connection.setGatewayConnected(true);
    expect(connection.connectionState()).toBe("connected");
    expect(connection.gatewayConnected()).toBe(true);
  });

  test("the reconnect hook runs on every gateway return except the first", () => {
    const { connection } = harness.start();
    harness.sockets.last().accept();
    connection.setGatewayConnected(true);
    expect(harness.log).not.toContain("reconnect");
    connection.setGatewayConnected(false);
    expect(connection.connectionState()).toBe("reconnecting");
    connection.setGatewayConnected(true);
    connection.setGatewayConnected(false);
    connection.setGatewayConnected(true);
    expect(harness.log.filter((entry) => entry === "reconnect")).toHaveLength(2);
  });

  test("messages from the current socket reach the handler", () => {
    harness.start();
    harness.sockets.last().accept();
    harness.sockets.last().receive({ type: "message" });
    expect(harness.log).toEqual(["open", 'message:{"type":"message"}']);
  });

  test("a constructor failure retries instead of throwing", () => {
    const original = globalThis.WebSocket;
    Object.assign(globalThis, {
      WebSocket: class {
        constructor() {
          throw new Error("blocked");
        }
      },
    });
    const { connection } = harness.start();
    expect(connection.connectionState()).toBe("reconnecting");
    Object.assign(globalThis, { WebSocket: original });
    harness.env.advance(1000);
    expect(harness.sockets.sockets).toHaveLength(1);
  });
});

describe("reconnect backoff", () => {
  test("delays grow 1.7x from one second and cap at twenty", () => {
    harness.start();
    const delays = [1000, 1700, 2890, 4913, 8352, 14_199, 20_000, 20_000];
    for (const delay of delays) {
      const before = harness.sockets.sockets.length;
      harness.sockets.last().drop();
      harness.env.advance(delay - 1);
      expect(harness.sockets.sockets).toHaveLength(before);
      harness.env.advance(1);
      expect(harness.sockets.sockets).toHaveLength(before + 1);
    }
  });

  test("a gateway connection resets the delay", () => {
    const { connection } = harness.start();
    harness.sockets.last().drop();
    harness.env.advance(1000);
    harness.sockets.last().drop();
    harness.env.advance(1700);
    harness.sockets.last().accept();
    connection.setGatewayConnected(true);
    harness.sockets.last().drop();
    expect(connection.connectionState()).toBe("reconnecting");
    harness.env.advance(1000);
    expect(harness.sockets.sockets).toHaveLength(4);
  });

  test("an error closes the socket and the close event schedules one retry", () => {
    harness.start();
    harness.sockets.last().fail();
    expect(harness.sockets.last().readyState).toBe(2);
    harness.sockets.last().drop();
    harness.sockets.last().drop();
    harness.env.advance(1000);
    expect(harness.sockets.sockets).toHaveLength(2);
    harness.env.advance(30_000);
    expect(harness.sockets.sockets).toHaveLength(2);
  });
});

describe("network", () => {
  test("offline closes the socket, pauses retries and online reconnects at once", () => {
    const { connection } = harness.start();
    harness.sockets.last().accept();
    connection.setGatewayConnected(true);
    harness.browser.goOffline();
    expect(connection.connectionState()).toBe("offline");
    expect(connection.gatewayConnected()).toBe(false);
    expect(harness.sockets.last().readyState).toBe(2);
    harness.env.advance(600_000);
    expect(harness.sockets.sockets).toHaveLength(1);
    harness.browser.goOnline();
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(connection.connectionState()).toBe("reconnecting");
  });

  test("starting offline waits for the online event", () => {
    harness.restore();
    harness = createConnectionHarness({ online: false });
    const { connection } = harness.start();
    expect(harness.sockets.sockets).toHaveLength(0);
    expect(connection.connectionState()).toBe("offline");
    harness.browser.goOnline();
    expect(harness.sockets.sockets).toHaveLength(1);
    expect(connection.connectionState()).toBe("connecting");
  });

  test("a socket that closes while offline does not retry", () => {
    const { connection } = harness.start();
    harness.browser.setOnlineSilently(false);
    harness.sockets.last().drop();
    expect(connection.connectionState()).toBe("offline");
    harness.env.advance(600_000);
    expect(harness.sockets.sockets).toHaveLength(1);
  });

  test("retry while offline stays offline and while online starts a fresh socket", () => {
    const { connection } = harness.start();
    harness.browser.setOnlineSilently(false);
    connection.retry();
    expect(connection.connectionState()).toBe("offline");
    expect(harness.sockets.sockets).toHaveLength(1);
    harness.browser.setOnlineSilently(true);
    connection.retry();
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(harness.sockets.sockets[0]?.readyState).toBe(2);
  });
});
