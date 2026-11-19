import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import type { Credentials } from "./auth.ts";

export type SlackFailure = { error: string; ok: false; retry_after?: string };
export type SlackReply<T extends object = object> = (T & { ok: true }) | SlackFailure;

type Wire =
  | { failure: string }
  | { retryAfter: string | null; status: number; statusText: string; text: string };

declare module "@slock/core/types" {
  interface Services {
    "slack.inFlight": { pending: Map<string, Promise<Wire>> };
  }
}

const env = service("env");
const inFlight = service("slack.inFlight");

async function send(url: string, init: RequestInit, failure: string): Promise<Wire> {
  try {
    const res = await env.fetch(url, init);
    return {
      retryAfter: res.headers.get("retry-after"),
      status: res.status,
      statusText: res.statusText,
      text: await res.text(),
    };
  } catch (error) {
    return { failure: errorMessage(error, failure) };
  }
}

function slackReply<T extends object>(wire: Wire): SlackReply<T> {
  if ("failure" in wire) return { error: wire.failure, ok: false };
  const retryAfter = wire.retryAfter ? { retry_after: wire.retryAfter } : {};
  try {
    return { ...JSON.parse(wire.text), ...retryAfter };
  } catch {
    return {
      error:
        wire.text.trim().slice(0, 500) ||
        (wire.status === 429
          ? "rate_limited"
          : `Slack responded ${wire.status} ${wire.statusText}`),
      ok: false,
      ...retryAfter,
    };
  }
}

function appendParam(target: FormData | URLSearchParams, key: string, value: string | string[]) {
  if (Array.isArray(value)) for (const item of value) target.append(key, item);
  else target.append(key, value);
}

function slackRequestBody(
  method: string,
  params: Record<string, string | string[]>,
  token: string,
): { body: FormData | string; headers: Record<string, string> } {
  if (
    method === "activity.archive" ||
    method === "activity.markRead" ||
    method === "conversations.view" ||
    method === "saved.get" ||
    (method === "messages.list" && params.message_ids)
  ) {
    const body = new FormData();
    body.append("token", token);
    for (const [key, value] of Object.entries(params)) {
      if (key !== "token") appendParam(body, key, value);
    }
    return { body, headers: {} };
  }
  const body = new URLSearchParams({ token });
  for (const [key, value] of Object.entries(params)) {
    if (key !== "token") appendParam(body, key, value);
  }
  return {
    body: body.toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  };
}

const DEDUPED_READ_METHODS = new Set([
  "client.counts",
  "client.userBoot",
  "conversations.info",
  "dnd.info",
  "users.channelSections.list",
  "users.info",
  "users.prefs.get",
]);

function apiUrl(creds: Credentials, method: string): string {
  return `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}`;
}

function postSlack(
  method: string,
  params: Record<string, string | string[]>,
  creds: Credentials,
): Promise<Wire> {
  const { body, headers } = slackRequestBody(method, params, creds.token);
  return send(
    apiUrl(creds, method),
    {
      body,
      headers: { ...headers, cookie: `d=${creds.slackSession}` },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    },
    "Slack request failed",
  );
}

function dedupedWire(key: string, start: () => Promise<Wire>): Promise<Wire> {
  const existing = inFlight.pending.get(key);
  if (existing) return existing;
  const wire = start().finally(() => inFlight.pending.delete(key));
  inFlight.pending.set(key, wire);
  return wire;
}

export async function callSlack<T extends object = object>(
  method: string,
  params: Record<string, string | string[]>,
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  if (!DEDUPED_READ_METHODS.has(method)) return slackReply(await postSlack(method, params, creds));
  const key = JSON.stringify([method, params, creds.domain, creds.token]);
  return slackReply(await dedupedWire(key, () => postSlack(method, params, creds)));
}

export async function callSlackMultipart<T extends object = object>(
  method: string,
  params: Record<string, string>,
  file: { bytes: Uint8Array; field: string; filename: string; type: string },
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  const body = new FormData();
  body.append("token", creds.token);
  for (const [key, value] of Object.entries(params)) body.append(key, value);
  body.append(
    file.field,
    new Blob([new Uint8Array(file.bytes)], { type: file.type }),
    file.filename,
  );
  return slackReply(
    await send(
      apiUrl(creds, method),
      {
        body,
        headers: { cookie: `d=${creds.slackSession}` },
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      },
      "Slack request failed",
    ),
  );
}

export async function callSlackEdge<T extends object = object>(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  const [enterpriseId] = creds.route.split(":");
  return slackReply(
    await send(
      `https://edgeapi.slack.com/cache/${enterpriseId}/${method}`,
      {
        body: JSON.stringify({ ...params, enterprise_token: creds.token, token: creds.token }),
        headers: { "content-type": "application/json", cookie: `d=${creds.slackSession}` },
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      },
      "Slack Edge request failed",
    ),
  );
}
