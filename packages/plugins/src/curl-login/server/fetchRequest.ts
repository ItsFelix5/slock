import { isRecord } from "@slock/core";
import type { SlackRequest } from "./curlRequest";

const FETCH_CALL = /\bfetch\(\s*("(?:[^"\\]|\\.)*")\s*,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {}
}

export function parseFetchRequest(raw: string): SlackRequest | undefined {
  const match = raw.trim().match(FETCH_CALL);
  const url = parseJson(match?.[1] ?? "");
  const init = parseJson(match?.[2] ?? "");
  if (typeof url !== "string" || !isRecord(init)) return;
  const headers = new Map<string, string>();
  if (isRecord(init.headers)) {
    for (const [name, value] of Object.entries(init.headers)) {
      if (typeof value === "string") headers.set(name.toLowerCase(), value);
    }
  }
  const cookie = headers.get("cookie") ?? "";
  headers.delete("cookie");
  return { body: typeof init.body === "string" ? init.body : "", cookie, headers, url };
}
