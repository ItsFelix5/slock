import { isRecord } from "@slock/core";
import type { SlackRequest } from "./curlRequest";

const BOUNDARY = /boundary=("?)([^\s;"]+)\1/i;
const FIELD_NAME = /content-disposition:[^\r\n]*\bname="([^"]*)"/i;
const BLANK_LINE = /\r?\n\r?\n/;
const MARKER_LINE = /^--([^\r\n]+)/;

function multipartField(body: string, boundary: string, field: string): string | undefined {
  for (const part of body.split(`--${boundary}`)) {
    if (part.match(FIELD_NAME)?.[1] !== field) continue;
    const blank = BLANK_LINE.exec(part);
    if (blank) return part.slice(blank.index + blank[0].length).trim();
  }
}

function jsonField(body: string, field: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    const value = isRecord(parsed) ? parsed[field] : undefined;
    return typeof value === "string" ? value : undefined;
  } catch {}
}

function bodyToken(request: SlackRequest): string | undefined {
  const { body } = request;
  const boundary =
    request.headers.get("content-type")?.match(BOUNDARY)?.[2] ?? body.match(MARKER_LINE)?.[1];
  if (boundary && FIELD_NAME.test(body)) return multipartField(body, boundary, "token");
  if (body.trimStart().startsWith("{")) return jsonField(body, "token");
  return new URLSearchParams(body).get("token") ?? undefined;
}

export function slackToken(request: SlackRequest, url: URL): string | undefined {
  return url.searchParams.get("token") ?? bodyToken(request);
}
