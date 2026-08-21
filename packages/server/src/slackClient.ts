import { type Credentials, slackCookieHeader } from "./auth.ts";
import { errorMessage } from "./http/errorMessage.ts";

async function parseSlackResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const retryAfter = res.headers.get("retry-after");
    return {
      error:
        text.trim().slice(0, 500) ||
        (res.status === 429 ? "rate_limited" : `Slack responded ${res.status} ${res.statusText}`),
      ok: false,
      ...(retryAfter ? { retry_after: retryAfter } : {}),
    };
  }
}

const SLACK_CALL_TIMEOUT_MS = 15_000;

function slackRequestBody(
  method: string,
  params: Record<string, string>,
  token: string,
): { body: FormData | string; headers: Record<string, string> } {
  if (
    method === "activity.markRead" ||
    method === "conversations.view" ||
    method === "saved.get" ||
    (method === "messages.list" && params.message_ids)
  ) {
    const body = new FormData();
    body.append("token", token);
    for (const [key, value] of Object.entries(params)) {
      if (key !== "token") body.append(key, value);
    }
    return { body, headers: {} };
  }
  const body = new URLSearchParams({ token });
  for (const [key, value] of Object.entries(params)) {
    if (key !== "token") body.append(key, value);
  }
  return {
    body: body.toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  };
}

export async function callSlack(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<any> {
  if (!creds) return { error: "not_configured", ok: false };
  const { body, headers } = slackRequestBody(method, params, creds.token);
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}&_x_app_name=client`;
  try {
    const res = await fetch(url, {
      body,
      headers: {
        ...headers,
        cookie: slackCookieHeader(creds),
      },
      method: "POST",
      signal: AbortSignal.timeout(SLACK_CALL_TIMEOUT_MS),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return { error: errorMessage(error, "Slack request failed"), ok: false };
  }
}

export async function callSlackMultipart(
  method: string,
  params: Record<string, string>,
  file: { bytes: Uint8Array; field: string; filename: string; type: string },
  creds: Credentials | null,
): Promise<any> {
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
      headers: { cookie: slackCookieHeader(creds) },
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return { error: errorMessage(error, "Slack request failed"), ok: false };
  }
}

export async function callSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<any> {
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
        cookie: slackCookieHeader(creds),
      },
      method: "POST",
      signal: AbortSignal.timeout(SLACK_CALL_TIMEOUT_MS),
    });
    return await parseSlackResponse(res);
  } catch (error) {
    return {
      error: errorMessage(error, "Slack Edge request failed"),
      ok: false,
    };
  }
}
