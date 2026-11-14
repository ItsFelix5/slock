import { FakeTarget } from "./fakeTarget";

export class FakeWebSocket extends FakeTarget {
  static created: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  readonly url: string;
  readonly init: unknown;

  constructor(url: string, init?: unknown) {
    super();
    this.url = url;
    this.init = init;
    FakeWebSocket.created.push(this);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("socket is not open");
    this.sent.push(data);
  }

  close() {
    if (this.readyState < FakeWebSocket.CLOSING) this.readyState = FakeWebSocket.CLOSING;
  }

  accept() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  receive(payload: unknown) {
    this.emit("message", { data: typeof payload === "string" ? payload : JSON.stringify(payload) });
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  fail() {
    this.emit("error");
  }

  sentJson(): Record<string, unknown>[] {
    return this.sent.map((raw) => JSON.parse(raw));
  }
}

export function installFakeWebSocket() {
  const original = globalThis.WebSocket;
  const sockets: FakeWebSocket[] = [];
  FakeWebSocket.created = sockets;
  Object.assign(globalThis, { WebSocket: FakeWebSocket });
  return {
    last(): FakeWebSocket {
      const socket = sockets.at(-1);
      if (!socket) throw new Error("no socket was created");
      return socket;
    },
    restore() {
      Object.assign(globalThis, { WebSocket: original });
    },
    sockets,
  };
}
