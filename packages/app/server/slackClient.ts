// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { rewriteSlackAssetUrls } from "./assets.ts";
import { type Credentials, slackCookieHeader } from "./auth.ts";
import { trimSlackEdgeResponse } from "./trim/slackEdgeResponse.ts";
import { trimSlackResponse } from "./trim/slackResponse.ts";

async function parseSlackResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const retryAfter = res.headers.get("retry-after");
    return {
      error: res.status === 429 ? "rate_limited" : "upstream_invalid_response",
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
  if (method === "conversations.view" || (method === "messages.list" && params.message_ids)) {
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

// Fetch + parse only, no trimming or asset-URL rewriting — purpose-built
// route handlers (routes/*.ts) trim exactly the fields they need themselves,
// then return through jsonResponse, which rewrites asset URLs once,
// centrally. `callSlack` below is a thin, auto-trimming wrapper kept only for
// operations that haven't migrated to a purpose route yet.
export async function fetchSlack(
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
  } catch {
    return { error: "upstream_timeout", ok: false };
  }
}
export async function callSlack(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<any> {
  return rewriteSlackAssetUrls(
    trimSlackResponse(method, await fetchSlack(method, params, creds)),
    creds,
  );
}
export async function fetchSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<any> {
  if (!creds) return { error: "not_configured", ok: false };
  const [enterpriseId] = creds.route.split(":");
  try {
    const res = await fetch(`https://edgeapi.slack.com/cache/${enterpriseId}/${method}`, {
      // Cache endpoints use the same browser-session credentials, including the
      // enterprise token, regardless of the resource being requested.
      body: JSON.stringify({ ...params, enterprise_token: creds.token, token: creds.token }),
      headers: { "content-type": "application/json", cookie: slackCookieHeader(creds) },
      method: "POST",
      signal: AbortSignal.timeout(SLACK_CALL_TIMEOUT_MS),
    });
    return await parseSlackResponse(res);
  } catch {
    return { error: "upstream_timeout", ok: false };
  }
}
export async function callSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<any> {
  return rewriteSlackAssetUrls(
    trimSlackEdgeResponse(method, await fetchSlackEdge(method, params, creds)),
    creds,
  );
}
