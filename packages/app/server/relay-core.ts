// biome-ignore-all lint/style/useNamingConvention: Relay payloads preserve Slack's wire field names.
import { compressedResponse } from "./http/compressedResponse.ts";
import {
  authResponse,
  type Credentials,
  cors,
  logoutResponse,
  slackCookieHeader,
} from "./relay-auth.ts";
import { emojiImageUrl, emojiListResponse } from "./relay-emoji.ts";
import {
  externalMediaProxyResponse,
  fileProxyResponse,
  fileUploadProxyResponse,
} from "./relay-files.ts";
import { trimSlackResponse } from "./relay-trim.ts";
import { unfurlResponse } from "./relay-unfurl.ts";

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
  if (method === "messages.list" && params.message_ids) {
    const body = new FormData();
    body.append("token", token);
    for (const [key, value] of Object.entries(params)) body.append(key, value);
    return { body, headers: {} };
  }
  const body = new URLSearchParams({ token, ...params });
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
    return trimSlackResponse(method, await parseSlackResponse(res));
  } catch {
    return { error: "upstream_timeout", ok: false };
  }
}
async function slackRelayResponse(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await callSlack(method, params, creds);
  return compressedResponse(JSON.stringify(data), cors, acceptEncoding);
}
// The browser-side callSlack coalesces every call issued within the same
// microtask (e.g. the handful of independent boot-time fetches) into one of
// these instead of one relay round trip each — the calls themselves still
// hit Slack individually (in parallel), only the browser<->relay hop shrinks.
async function slackBatchRelayResponse(
  calls: { method: string; params?: Record<string, string> }[],
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  const results = await Promise.all(
    calls.map((call) => callSlack(call.method, call.params ?? {}, creds)),
  );
  return compressedResponse(JSON.stringify({ results }), cors, acceptEncoding);
}
async function callSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
) {
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
    return parseSlackResponse(res);
  } catch {
    return { error: "upstream_timeout", ok: false };
  }
}
async function slackEdgeRelayResponse(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await callSlackEdge(method, params, creds);
  return compressedResponse(JSON.stringify(data), cors, acceptEncoding);
}
export async function routeRelayRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  creds: Credentials | null,
  secure: boolean,
  acceptEncoding: string | null,
  body: {
    json(): Promise<Record<string, unknown>>;
    text(): Promise<string>;
    buffer(): Promise<Uint8Array>;
  },
): Promise<Response | null> {
  if (method === "POST" && pathname === "/slack/batch") {
    const payload = (await body.json()) as {
      calls?: { method: string; params?: Record<string, string> }[];
    };
    return slackBatchRelayResponse(payload.calls ?? [], creds, acceptEncoding);
  }
  if (method === "POST" && pathname.startsWith("/slack/")) {
    const slackMethod = pathname.slice("/slack/".length);
    if (!slackMethod) return new Response("missing method", { status: 400 });
    return slackRelayResponse(
      slackMethod,
      (await body.json()) as Record<string, string>,
      creds,
      acceptEncoding,
    );
  }
  if (method === "POST" && pathname.startsWith("/slack-edge/")) {
    const slackMethod = pathname.slice("/slack-edge/".length);
    if (!slackMethod) return new Response("missing method", { status: 400 });
    return slackEdgeRelayResponse(slackMethod, await body.json(), creds, acceptEncoding);
  }
  if (method === "GET" && pathname === "/emoji") {
    return emojiListResponse(creds, callSlack, acceptEncoding);
  }
  if (method === "GET" && pathname === "/emoji-image") {
    const url = await emojiImageUrl(searchParams.get("name"), creds, callSlack);
    const res = await fileProxyResponse(url, creds);
    res.headers.set("vary", "Cookie");
    return res;
  }
  if (method === "GET" && pathname === "/file") {
    return fileProxyResponse(searchParams.get("url"), creds);
  }
  if (method === "POST" && pathname === "/file-upload") {
    return fileUploadProxyResponse(
      await body.buffer(),
      searchParams.get("url"),
      searchParams.get("filename"),
    );
  }
  if (method === "GET" && pathname === "/media-proxy") {
    return externalMediaProxyResponse(searchParams.get("url"));
  }
  if (method === "GET" && pathname === "/unfurl") {
    return unfurlResponse(searchParams.get("url"));
  }
  if (method === "POST" && pathname === "/auth") {
    const raw = await body.text();
    if (!raw) return new Response("missing raw", { status: 400 });
    return authResponse(raw, secure);
  }
  if (method === "POST" && pathname === "/auth/logout") {
    return logoutResponse();
  }
  return null;
}
