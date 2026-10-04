import { isRecord } from "@slock/types";
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

export type CanvasResponse<T> =
  | { ok: true; value: T }
  | { error: string; ok: false; status: number };

async function canvasErrorDescription(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    return isRecord(body) && typeof body.error_description === "string"
      ? body.error_description
      : null;
  } catch {
    return null;
  }
}

export async function postCanvas(
  path: string,
  form: Record<string, string>,
  creds: Credentials,
): Promise<CanvasResponse<Uint8Array>> {
  const res = await fetch(`https://${creds.domain}/canvas/-/${path}`, {
    body: new URLSearchParams({ ...form, token: creds.token }).toString(),
    headers: {
      cookie: `d=${creds.slackSession}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    return {
      error: (await canvasErrorDescription(res)) ?? `canvas ${path} failed: ${res.status}`,
      ok: false,
      status: res.status,
    };
  }
  return { ok: true, value: new Uint8Array(await res.arrayBuffer()) };
}

export async function fetchCanvasRaw(
  threadId: string,
  creds: Credentials,
): Promise<{ bytes: Uint8Array; ok: true } | { error: string; ok: false }> {
  const response = await postCanvas(
    "load-data/editor/1",
    { request_binary: encodeLoadDataRequest(threadId, 1) },
    creds,
  );
  if (!response.ok) return { error: response.error, ok: false };
  return { bytes: response.value, ok: true };
}

function encodeVersionRequest(
  version: { documentId: string; sequence: number; versionId: string },
  threadId: string,
): string {
  const bytes = [
    ...lenDelim(1, strBytes(threadId)),
    ...lenDelim(2, strBytes(version.documentId)),
    ...lenDelim(3, strBytes(version.versionId)),
    ...varintField(5, version.sequence),
  ];
  return Buffer.from(bytes).toString("base64");
}

export async function fetchCanvasVersion(
  threadId: string,
  version: { documentId: string; sequence: number; versionId: string },
  creds: Credentials,
): Promise<{ bytes: Uint8Array; ok: true } | { error: string; ok: false }> {
  const response = await postCanvas(
    "call-handler/load-document-version",
    {
      handler: "114",
      request_binary: encodeVersionRequest(version, threadId),
      secret_paths: "{}",
    },
    creds,
  );
  if (!response.ok) return { error: response.error, ok: false };
  return { bytes: response.value, ok: true };
}
