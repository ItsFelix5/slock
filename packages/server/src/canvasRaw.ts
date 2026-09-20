import type { Credentials } from "./auth.ts";

function writeVarint(n: bigint): number[] {
  const out: number[] = [];
  while (true) {
    let byte = Number(n & 0x7fn);
    n >>= 7n;
    if (n !== 0n) byte |= 0x80;
    out.push(byte);
    if (n === 0n) break;
  }
  return out;
}

function tagBytes(field: number, wireType: number): number[] {
  return writeVarint(BigInt((field << 3) | wireType));
}

function lenDelim(field: number, bytes: number[]): number[] {
  return [...tagBytes(field, 2), ...writeVarint(BigInt(bytes.length)), ...bytes];
}

function varintField(field: number, n: number): number[] {
  return [...tagBytes(field, 0), ...writeVarint(BigInt(n))];
}

function strBytes(s: string): number[] {
  return [...new TextEncoder().encode(s)];
}

function encodeLoadDataRequest(threadId: string, page = 1): string {
  const inner3 = [...varintField(1, 1), ...lenDelim(2, strBytes(threadId))];
  const bytes = [
    ...lenDelim(1, strBytes(threadId)),
    ...lenDelim(3, inner3),
    ...lenDelim(5, strBytes("editor")),
    ...varintField(6, page),
  ];
  return Buffer.from(bytes).toString("base64");
}

export async function fetchCanvasRaw(
  threadId: string,
  creds: Credentials,
): Promise<{ bytes: Uint8Array; ok: true } | { error: string; ok: false }> {
  const requestBinary = encodeLoadDataRequest(threadId, 1);
  const res = await fetch(`https://${creds.domain}/canvas/-/load-data/editor/1`, {
    body: new URLSearchParams({ request_binary: requestBinary, token: creds.token }).toString(),
    headers: {
      cookie: `d=${creds.slackSession}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    return { error: `canvas load-data failed: ${res.status} ${res.statusText}`, ok: false };
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), ok: true };
}
