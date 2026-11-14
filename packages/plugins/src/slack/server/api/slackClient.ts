import { errorMessage } from "@slock/core";
import type { Credentials } from "./auth.ts";

export type SlackFailure = { error: string; ok: false; retry_after?: string };
export type SlackReply<T extends object = object> = (T & { ok: true }) | SlackFailure;

export async function parseSlackResponse<T extends object>(res: Response): Promise<SlackReply<T>> {
  const text = await res.text();
  const retryAfter = res.headers.get("retry-after");
  try {
    const data = JSON.parse(text);
    return retryAfter ? { ...data, retry_after: retryAfter } : data;
  } catch {
    return {
      error:
        text.trim().slice(0, 500) ||
        (res.status === 429 ? "rate_limited" : `Slack responded ${res.status} ${res.statusText}`),
      ok: false,
      ...(retryAfter ? { retry_after: retryAfter } : {}),
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

const inFlight = new Map<string, { reply: Promise<SlackReply>; joined: boolean }>();

export async function callSlack<T extends object = object>(
  method: string,
  params: Record<string, string | string[]>,
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  if (!DEDUPED_READ_METHODS.has(method)) return postSlack<T>(method, params, creds);
  const key = JSON.stringify([method, params, creds.domain, creds.token]);
  const existing = inFlight.get(key);
  if (existing) existing.joined = true;
  const entry = existing ?? {
    joined: false,
    reply: postSlack(method, params, creds).finally(() => inFlight.delete(key)),
  };
  if (!existing) inFlight.set(key, entry);
  const reply = await entry.reply;
  return (entry.joined ? structuredClone(reply) : reply) as SlackReply<T>;
}

async function postSlack<T extends object>(
  method: string,
  params: Record<string, string | string[]>,
  creds: Credentials,
): Promise<SlackReply<T>> {
  const { body, headers } = slackRequestBody(method, params, creds.token);
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}`;
  try {
    const res = await fetch(url, {
      body,
      headers: {
        ...headers,
        cookie: `d=${creds.slackSession}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return { error: errorMessage(error, "Slack request failed"), ok: false };
  }
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
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}`;
  try {
    const res = await fetch(url, {
      body,
      headers: { cookie: `d=${creds.slackSession}` },
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return { error: errorMessage(error, "Slack request failed"), ok: false };
  }
}

export async function callSlackEdge<T extends object = object>(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  const [enterpriseId] = creds.route.split(":");
  try {
    const res = await fetch(`https://edgeapi.slack.com/cache/${enterpriseId}/${method}`, {
      body: JSON.stringify({
        ...params,
        enterprise_token: creds.token,
        token: creds.token,
      }),
      headers: {
        "content-type": "application/json",
        cookie: `d=${creds.slackSession}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return {
      error: errorMessage(error, "Slack Edge request failed"),
      ok: false,
    };
  }
}
