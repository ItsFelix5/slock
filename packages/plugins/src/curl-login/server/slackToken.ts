import { isRecord } from "@slock/core";
import type { SlackRequest } from "./curlRequest";
import { parseJson } from "./fetchRequest";

const BOUNDARY = /boundary=("?)([^\s;"]+)\1/i;
const FIELD_NAME = /content-disposition:[^\r\n]*\bname="([^"]*)"/i;
const BLANK_LINE = /\r?\n\r?\n/;
const MARKER_LINE = /^--([^\r\n]+)/;

function partValue(part: string, field: string): string | undefined {
  const blank = BLANK_LINE.exec(part);
  return part.match(FIELD_NAME)?.[1] === field && blank
    ? part.slice(blank.index + blank[0].length).trim()
    : undefined;
}

function multipartField(body: string, boundary: string, field: string): string | undefined {
  return body
    .split(`--${boundary}`)
    .map((part) => partValue(part, field))
    .find((value) => value !== undefined);
}

function jsonField(body: string, field: string): string | undefined {
  const parsed = parseJson(body);
  const value = isRecord(parsed) ? parsed[field] : undefined;
  return typeof value === "string" ? value : undefined;
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
