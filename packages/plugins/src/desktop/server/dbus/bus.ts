import { split } from "./marshal";
import { CALL, ERROR, frame, type Message, parse, RETURN, SIGNAL } from "./message";

export type Member = {
  in: string;
  out: string;
  run(args: unknown[]): unknown[] | Promise<unknown[]>;
};
export type Property = { sig: string; get(): unknown };
export type Interface = {
  name: string;
  methods: Record<string, Member>;
  properties: Record<string, Property>;
  signals: Record<string, string>;
};

export class DbusError extends Error {
  readonly dbusName: string;

  constructor(dbusName: string, message: string) {
    super(message);
    this.dbusName = dbusName;
  }
}

function address(uid: number): string {
  for (const entry of (Bun.env.DBUS_SESSION_BUS_ADDRESS ?? "").split(";")) {
    if (!entry.startsWith("unix:")) continue;
    const params = new Map(
      entry
        .slice(5)
        .split(",")
        .map((pair) => pair.split("=") as [string, string]),
    );
    const path = params.get("path");
    if (path) return decodeURIComponent(path);
    const abstract = params.get("abstract");
    if (abstract) return `\0${decodeURIComponent(abstract)}`;
  }
  return `/run/user/${uid}/bus`;
}

function introspect(interfaces: Interface[]): string {
  const args = (sig: string, direction: string) =>
    split(sig)
      .map((type) => `<arg type="${type}" direction="${direction}"/>`)
      .join("");
  const body = interfaces
    .map((iface) => {
      const methods = Object.entries(iface.methods).map(
        ([name, m]) => `<method name="${name}">${args(m.in, "in")}${args(m.out, "out")}</method>`,
      );
      const properties = Object.entries(iface.properties).map(
        ([name, p]) => `<property name="${name}" type="${p.sig}" access="read"/>`,
      );
      const signals = Object.entries(iface.signals).map(
        ([name, sig]) => `<signal name="${name}">${args(sig, "out")}</signal>`,
      );
      return `<interface name="${iface.name}">${methods.join("")}${properties.join("")}${signals.join("")}</interface>`;
    })
    .join("");
  return `<node>${body}</node>`;
}

export class Bus {
  name = "";
  private socket: { write(data: Uint8Array): unknown; end(): unknown } | undefined;
  private serial = 0;
  private pending = new Map<
    number,
    { resolve(body: unknown[]): void; reject(error: Error): void }
  >();
  private objects = new Map<string, Map<string, Interface>>();
  private closers: (() => void)[] = [];
  private received = new Uint8Array(0);
  private authenticated: ((error?: Error) => void) | undefined;
  private closed = false;

  async open(path: string, uid: number) {
    const authed = new Promise<void>((resolve, reject) => {
      this.authenticated = (error) => (error ? reject(error) : resolve());
    });
    this.socket = await Bun.connect({
      socket: {
        close: () => this.shutdown(),
        data: (_, chunk) => this.receive(chunk),
        error: () => this.shutdown(),
      },
      unix: path,
    });
    const hex = [...String(uid)].map((c) => c.charCodeAt(0).toString(16)).join("");
    this.socket.write(new TextEncoder().encode(`\0AUTH EXTERNAL ${hex}\r\n`));
    await authed;
    this.socket.write(new TextEncoder().encode("BEGIN\r\n"));
    const [name] = await this.call(
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "Hello",
    );
    this.name = String(name);
  }

  onClose(listener: () => void) {
    this.closers.push(listener);
  }

  close() {
    this.socket?.end();
    this.shutdown();
  }

  private shutdown() {
    if (this.closed) return;
    this.closed = true;
    for (const { reject } of this.pending.values()) reject(new Error("bus closed"));
    this.pending.clear();
    for (const listener of this.closers) listener();
  }

  private send(message: Omit<Message, "flags" | "serial"> & { flags?: number }): number {
    const serial = ++this.serial;
    this.socket?.write(frame({ flags: 0, ...message, serial }));
    return serial;
  }

  call(
    destination: string,
    path: string,
    iface: string,
    member: string,
    sig = "",
    args: unknown[] = [],
  ): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const serial = this.send({
        body: args,
        destination,
        interface: iface,
        member,
        path,
        sig,
        type: CALL,
      });
      this.pending.set(serial, { reject, resolve });
    });
  }

  emit(path: string, iface: string, member: string, sig = "", args: unknown[] = []) {
    this.send({ body: args, interface: iface, member, path, sig, type: SIGNAL });
  }

  export(path: string, iface: Interface) {
    const at = this.objects.get(path) ?? new Map<string, Interface>();
    at.set(iface.name, iface);
    this.objects.set(path, at);
  }

  async requestName(name: string) {
    const [reply] = await this.call(
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "RequestName",
      "su",
      [name, 4],
    );
    if (reply !== 1)
      throw new DbusError("org.freedesktop.DBus.Error.AddressInUse", `could not own ${name}`);
  }

  private receive(chunk: Uint8Array) {
    if (this.authenticated) {
      const text = new TextDecoder().decode(chunk);
      const line = text.indexOf("\r\n");
      if (line === -1) return;
      const done = this.authenticated;
      this.authenticated = undefined;
      if (!text.startsWith("OK"))
        return done(new Error(`dbus auth failed: ${text.slice(0, line)}`));
      done();
      chunk = chunk.subarray(new TextEncoder().encode(text.slice(0, line + 2)).length);
    }
    this.received = Uint8Array.from([...this.received, ...chunk]);
    for (;;) {
      if (this.received.length < 16) return;
      const view = new DataView(this.received.buffer, this.received.byteOffset);
      const total = ((16 + view.getUint32(12, true) + 7) & ~7) + view.getUint32(4, true);
      if (this.received.length < total) return;
      const data = this.received.slice(0, total);
      this.received = this.received.slice(total);
      this.dispatch(parse(data));
    }
  }

  private dispatch(message: Message) {
    if (message.type === RETURN || message.type === ERROR) {
      const waiting = this.pending.get(message.replySerial ?? -1);
      this.pending.delete(message.replySerial ?? -1);
      if (message.type === RETURN) waiting?.resolve(message.body);
      else
        waiting?.reject(
          new DbusError(message.errorName ?? "", String(message.body[0] ?? message.errorName)),
        );
    } else if (message.type === CALL) void this.handle(message);
  }

  private reply(call: Message, sig: string, body: unknown[]) {
    if (call.flags & 1) return;
    this.send({ body, destination: call.sender, replySerial: call.serial, sig, type: RETURN });
  }

  private fail(call: Message, name: string, text: string) {
    if (call.flags & 1) return;
    this.send({
      body: [text],
      destination: call.sender,
      errorName: name,
      replySerial: call.serial,
      sig: "s",
      type: ERROR,
    });
  }

  private async handle(call: Message) {
    const interfaces = this.objects.get(call.path ?? "");
    if (!interfaces)
      return this.fail(call, "org.freedesktop.DBus.Error.UnknownObject", `no object ${call.path}`);
    const { interface: name, member = "" } = call;
    if (name === "org.freedesktop.DBus.Introspectable" && member === "Introspect")
      return this.reply(call, "s", [introspect([...interfaces.values()])]);
    if (name === "org.freedesktop.DBus.Properties") return this.properties(call, interfaces);
    const target = name
      ? interfaces.get(name)
      : [...interfaces.values()].find((i) => i.methods[member]);
    const method = target?.methods[member];
    if (!method)
      return this.fail(call, "org.freedesktop.DBus.Error.UnknownMethod", `no method ${member}`);
    try {
      this.reply(call, method.out, await method.run(call.body));
    } catch (error) {
      this.fail(call, "org.freedesktop.DBus.Error.Failed", String(error));
    }
  }

  private properties(call: Message, interfaces: Map<string, Interface>) {
    const [first, second] = call.body as string[];
    const iface = interfaces.get(String(first));
    if (!iface)
      return this.fail(call, "org.freedesktop.DBus.Error.UnknownInterface", String(first));
    if (call.member === "GetAll") {
      const all = Object.entries(iface.properties).map(([key, p]) => [
        key,
        { sig: p.sig, value: p.get() },
      ]);
      return this.reply(call, "a{sv}", [all]);
    }
    const property = iface.properties[String(second)];
    if (call.member !== "Get" || !property)
      return this.fail(call, "org.freedesktop.DBus.Error.UnknownProperty", String(second));
    this.reply(call, "v", [{ sig: property.sig, value: property.get() }]);
  }
}

export async function connectSession(): Promise<Bus> {
  const uid = process.getuid?.() ?? 0;
  const bus = new Bus();
  await bus.open(address(uid), uid);
  return bus;
}
