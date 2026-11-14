import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { createConnectionHarness } from "../../../../src/realtime/testing/connectionHarness";

let harness: ReturnType<typeof createConnectionHarness>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  harness = createConnectionHarness();
});

afterEach(() => {
  harness.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function connected() {
  const started = harness.start();
  harness.sockets.last().accept();
  started.connection.setGatewayConnected(true);
  return started;
}

describe("silent death", () => {
  test("a visible tab with a dead socket reconnects and resyncs within 40 seconds", () => {
    const { connection } = connected();
    const dead = harness.sockets.last();
    jest.advanceTimersByTime(20_000);
    expect(dead.sentJson()).toEqual([{ type: "ping" }]);
    jest.advanceTimersByTime(20_000);
    expect(dead.readyState).toBe(2);
    expect(connection.gatewayConnected()).toBe(false);
    expect(connection.connectionState()).toBe("reconnecting");
    expect(harness.sockets.sockets).toHaveLength(2);
    harness.sockets.last().accept();
    connection.setGatewayConnected(true);
    expect(harness.log.filter((entry) => entry === "reconnect")).toHaveLength(1);
  });

  test("pongs keep a quiet socket alive indefinitely", () => {
    connected();
    for (let tick = 0; tick < 100; tick++) {
      jest.advanceTimersByTime(20_000);
      harness.sockets.last().receive({ type: "pong" });
    }
    expect(harness.sockets.sockets).toHaveLength(1);
    expect(harness.sockets.last().sent).toHaveLength(100);
  });

  test("any gateway event counts as a reply", () => {
    connected();
    jest.advanceTimersByTime(20_000);
    harness.sockets.last().receive({ channel: "C1", ts: "1.1", type: "message" });
    jest.advanceTimersByTime(20_000);
    expect(harness.sockets.sockets).toHaveLength(1);
  });

  test("a socket stuck connecting is replaced after 40 seconds", () => {
    const { connection } = harness.start();
    jest.advanceTimersByTime(39_999);
    expect(harness.sockets.sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(connection.connectionState()).toBe("connecting");
  });

  test("an early close cancels the heartbeat of the old socket", () => {
    connected();
    harness.sockets.last().drop();
    jest.advanceTimersByTime(1000);
    harness.sockets.last().accept();
    jest.advanceTimersByTime(20_000);
    expect(harness.sockets.last().sent).toHaveLength(1);
    expect(harness.sockets.sockets).toHaveLength(2);
  });

  test("a send that throws closes the socket and reports failure", () => {
    const { connection } = connected();
    const socket = harness.sockets.last();
    socket.send = () => {
      throw new Error("broken pipe");
    };
    expect(connection.send({ type: "typing" })).toBe(false);
    expect(socket.readyState).toBe(2);
  });
});

describe("send", () => {
  test("it only sends while the socket is open", () => {
    const { connection } = harness.start();
    expect(connection.send({ type: "watch_presence" })).toBe(false);
    harness.sockets.last().accept();
    expect(connection.send({ ids: ["U1"], type: "watch_presence" })).toBe(true);
    expect(harness.sockets.last().sentJson()).toEqual([{ ids: ["U1"], type: "watch_presence" }]);
  });
});

describe("tab visibility", () => {
  test("coming back after more than 30 hidden seconds starts a fresh socket", () => {
    connected();
    harness.browser.setVisible(false);
    jest.advanceTimersByTime(10_000);
    harness.sockets.last().receive({ type: "pong" });
    jest.advanceTimersByTime(20_001);
    harness.browser.setVisible(true);
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(harness.sockets.sockets[0]?.readyState).toBe(2);
  });

  test("a short absence keeps the socket", () => {
    connected();
    harness.browser.setVisible(false);
    jest.advanceTimersByTime(30_000);
    harness.browser.setVisible(true);
    expect(harness.sockets.sockets).toHaveLength(1);
  });

  test("becoming visible during a backoff reconnects immediately", () => {
    harness.start();
    harness.sockets.last().drop();
    harness.sockets.last().drop();
    harness.browser.setVisible(false);
    harness.browser.setVisible(true);
    expect(harness.sockets.sockets).toHaveLength(2);
  });

  test("becoming visible while offline does nothing", () => {
    harness.start();
    harness.browser.setVisible(false);
    harness.browser.setOnlineSilently(false);
    jest.advanceTimersByTime(60_000);
    harness.browser.setVisible(true);
    expect(harness.sockets.sockets).toHaveLength(1);
  });
});

describe("stale sockets and disposal", () => {
  test("events from a replaced socket are ignored", () => {
    const { connection } = connected();
    const old = harness.sockets.last();
    connection.retry();
    harness.log.length = 0;
    old.receive({ type: "message" });
    old.drop();
    jest.advanceTimersByTime(5000);
    expect(harness.log).toEqual([]);
    expect(harness.sockets.sockets).toHaveLength(2);
  });

  test("disposing removes every listener and stops all timers", () => {
    const { connection, dispose } = connected();
    const socket = harness.sockets.last();
    connection.setGatewayConnected(false);
    expect(harness.browser.listenerCount()).toBe(3);
    dispose();
    expect(harness.browser.listenerCount()).toBe(0);
    expect(socket.readyState).toBe(2);
    harness.log.length = 0;
    socket.receive({ type: "message" });
    socket.drop();
    jest.advanceTimersByTime(600_000);
    expect(harness.sockets.sockets).toHaveLength(1);
    expect(socket.sent).toEqual([]);
    expect(harness.log).toEqual([]);
  });

  test("online and visibility events after disposal start nothing", () => {
    const { dispose } = connected();
    dispose();
    harness.browser.goOffline();
    harness.browser.goOnline();
    harness.browser.setVisible(false);
    harness.browser.setVisible(true);
    expect(harness.sockets.sockets).toHaveLength(1);
  });
});

describe("self online grace", () => {
  test("a short gateway outage still counts as online for 45 seconds", () => {
    const { connection } = connected();
    expect(connection.isSelfOnline()).toBe(true);
    connection.setGatewayConnected(false);
    jest.advanceTimersByTime(44_999);
    expect(connection.isSelfOnline()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(connection.isSelfOnline()).toBe(false);
    connection.setGatewayConnected(true);
    expect(connection.isSelfOnline()).toBe(true);
  });
});
