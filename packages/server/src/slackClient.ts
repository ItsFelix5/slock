import type { Credentials } from "./auth.ts";
import { errorMessage } from "./http/compressedResponse.ts";

export type SlackFailure = { error: string; ok: false; retry_after?: string };
export type SlackReply<T extends object = object> = (T & { ok: true }) | SlackFailure;

async function parseSlackResponse<T extends object>(res: Response): Promise<SlackReply<T>> {
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

export async function callSlack<T extends object = object>(
  method: string,
  params: Record<string, string | string[]>,
  creds: Credentials | null,
): Promise<SlackReply<T>> {
  if (!creds) return { error: "not_configured", ok: false };
  const { body, headers } = slackRequestBody(method, params, creds.token);
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}&_x_app_name=client`;
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
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}&_x_app_name=client`;
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

export function botToken(): string | undefined {
  return Bun.env.SLACK_BOT_TOKEN;
}

export async function callSlackBot<T extends object = object>(
  method: string,
  params: Record<string, string>,
): Promise<SlackReply<T>> {
  const token = botToken();
  if (!token) return { error: "bot_not_configured", ok: false };
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      body: new URLSearchParams(params).toString(),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return { error: errorMessage(error, "Slack bot request failed"), ok: false };
  }
}
