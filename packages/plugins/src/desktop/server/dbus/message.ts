import { decode, encode, Reader, type Variant, Writer } from "./marshal";

export const CALL = 1;
export const RETURN = 2;
export const ERROR = 3;
export const SIGNAL = 4;
export const FIELDS = {
  destination: 6,
  errorName: 4,
  interface: 2,
  member: 3,
  path: 1,
  replySerial: 5,
  sender: 7,
  signature: 8,
};

export type Message = {
  type: number;
  serial: number;
  flags: number;
  path?: string;
  interface?: string;
  member?: string;
  errorName?: string;
  replySerial?: number;
  destination?: string;
  sender?: string;
  sig: string;
  body: unknown[];
};

export function frame(message: Message): Uint8Array {
  const body = message.sig ? encode(message.sig, message.body) : [];
  const fields: [number, Variant][] = [];
  const add = (code: number, sig: string, value: unknown) => {
    if (value !== undefined) fields.push([code, { sig, value }]);
  };
  add(FIELDS.path, "o", message.path);
  add(FIELDS.interface, "s", message.interface);
  add(FIELDS.member, "s", message.member);
  add(FIELDS.errorName, "s", message.errorName);
  add(FIELDS.replySerial, "u", message.replySerial);
  add(FIELDS.destination, "s", message.destination);
  add(FIELDS.signature, "g", message.sig || undefined);
  const writer = new Writer();
  writer.bytes.push(0x6c, message.type, message.flags, 1);
  writer.write("u", body.length);
  writer.write("u", message.serial);
  writer.write("a(yv)", fields);
  writer.align(8);
  return Uint8Array.from([...writer.bytes, ...body]);
}

export function parse(data: Uint8Array): Message {
  const reader = new Reader(data);
  reader.at = 1;
  const type = Number(reader.read("y"));
  const flags = Number(reader.read("y"));
  reader.read("y");
  const bodyLength = Number(reader.read("u"));
  const serial = Number(reader.read("u"));
  const fields = new Map(
    (reader.read("a(yv)") as [number, Variant][]).map(([code, v]) => [code, v.value]),
  );
  reader.align(8);
  const sig = String(fields.get(FIELDS.signature) ?? "");
  const body = sig ? decode(sig, data.subarray(reader.at, reader.at + bodyLength)) : [];
  const text = (code: number) => (fields.has(code) ? String(fields.get(code)) : undefined);
  return {
    body,
    destination: text(FIELDS.destination),
    errorName: text(FIELDS.errorName),
    flags,
    interface: text(FIELDS.interface),
    member: text(FIELDS.member),
    path: text(FIELDS.path),
    replySerial: fields.has(FIELDS.replySerial)
      ? Number(fields.get(FIELDS.replySerial))
      : undefined,
    sender: text(FIELDS.sender),
    serial,
    sig,
    type,
  };
}
