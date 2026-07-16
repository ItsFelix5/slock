// biome-ignore-all lint/style/useNamingConvention: Relay payloads preserve Slack's wire field names.
import { fileProxyResponse, fileUploadProxyResponse } from "./relay-files.ts";
import { unfurlResponse } from "./relay-unfurl.ts";

export type Credentials = { domain: string; token: string; route: string; slackSession: string };
type AuthPayload = Credentials;
const CREDS_COOKIE = "slock_creds";
const INVALID_SLACK_SESSION_RE = /[;\s]/;

function extractSlackSession(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    return value.startsWith("xoxd-") && !INVALID_SLACK_SESSION_RE.test(value) ? value : null;
  }
  return null;
}

function isAuthPayload(value: unknown): value is AuthPayload {
  if (!(value && typeof value === "object")) return false;
  const payload = value as Partial<AuthPayload>;
  return (
    typeof payload.domain === "string" &&
    payload.domain.length > 0 &&
    typeof payload.token === "string" &&
    payload.token.length > 0 &&
    typeof payload.route === "string" &&
    payload.route.length > 0 &&
    typeof payload.slackSession === "string" &&
    payload.slackSession.startsWith("xoxd-") &&
    !INVALID_SLACK_SESSION_RE.test(payload.slackSession)
  );
}

export function slackCookieHeader(creds: Credentials): string {
  return `d=${creds.slackSession}`;
}

export function encodeCredsCookie(creds: Credentials, secure: boolean): string {
  const value = encodeURIComponent(JSON.stringify(creds));
  const flags = ["HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=34560000"];
  if (secure) flags.push("Secure");
  return `${CREDS_COOKIE}=${value}; ${flags.join("; ")}`;
}
export function parseCredsCookie(cookieHeader: string | null): Credentials | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== CREDS_COOKIE) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1).trim()));
      if (isAuthPayload(parsed)) return parsed;
      // Migrate credentials saved before Slock stopped retaining the entire
      // copied Slack Cookie header. /config rewrites this canonical value.
      const slackSession =
        typeof parsed?.cookie === "string" ? extractSlackSession(parsed.cookie) : null;
      const migrated = { ...parsed, slackSession };
      if (isAuthPayload(migrated)) {
        const { domain, route, token } = migrated;
        return { domain, route, slackSession: migrated.slackSession, token };
      }
    } catch {
      return null;
    }
  }
  return null;
}

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

export async function callSlack(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<any> {
  if (!creds) return { error: "not_configured", ok: false };
  const body = new URLSearchParams({ token: creds.token, ...params });
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}&_x_app_name=client`;
  const res = await fetch(url, {
    body: body.toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: slackCookieHeader(creds),
    },
    method: "POST",
  });
  return parseSlackResponse(res);
}
export const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
function authResponse(raw: string, secure: boolean): Response {
  try {
    const parsed = JSON.parse(raw);
    if (!isAuthPayload(parsed)) throw new Error("Invalid Slack credentials.");
    const { domain, route, slackSession, token } = parsed;
    const creds = { domain, route, slackSession, token };
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "set-cookie": encodeCredsCookie(creds, secure) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't parse that request.";
    return new Response(JSON.stringify({ error: message, ok: false }), {
      headers: cors,
      status: 400,
    });
  }
}
function logoutResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      ...cors,
      "set-cookie": `${CREDS_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    },
  });
}
async function slackRelayResponse(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<Response> {
  const data = await callSlack(method, params, creds);
  return new Response(JSON.stringify(data), { headers: cors });
}
async function callSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
) {
  if (!creds) return { error: "not_configured", ok: false };
  const [enterpriseId] = creds.route.split(":");
  const res = await fetch(`https://edgeapi.slack.com/cache/${enterpriseId}/${method}`, {
    // Cache endpoints use the same browser-session credentials, including the
    // enterprise token, regardless of the resource being requested.
    body: JSON.stringify({ ...params, enterprise_token: creds.token, token: creds.token }),
    headers: { "content-type": "application/json", cookie: slackCookieHeader(creds) },
    method: "POST",
  });
  return parseSlackResponse(res);
}
async function slackEdgeRelayResponse(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<Response> {
  const data = await callSlackEdge(method, params, creds);
  return new Response(JSON.stringify(data), { headers: cors });
}
export async function routeRelayRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  creds: Credentials | null,
  secure: boolean,
  body: {
    json(): Promise<Record<string, unknown>>;
    text(): Promise<string>;
    buffer(): Promise<Uint8Array>;
  },
): Promise<Response | null> {
  if (method === "POST" && pathname.startsWith("/slack/")) {
    const slackMethod = pathname.slice("/slack/".length);
    if (!slackMethod) return new Response("missing method", { status: 400 });
    return slackRelayResponse(slackMethod, (await body.json()) as Record<string, string>, creds);
  }
  if (method === "POST" && pathname.startsWith("/slack-edge/")) {
    const slackMethod = pathname.slice("/slack-edge/".length);
    if (!slackMethod) return new Response("missing method", { status: 400 });
    return slackEdgeRelayResponse(slackMethod, await body.json(), creds);
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
  if (method === "GET" && pathname === "/unfurl") {
    return unfurlResponse(searchParams.get("url"));
  }
  if (method === "GET" && pathname === "/config") {
    return configResponse(creds, secure);
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
export function configResponse(creds: Credentials | null, secure = false): Response {
  return new Response(
    JSON.stringify({
      configured: creds !== null,
      domain: creds?.domain ?? null,
      // `route` is "T..." on a plain workspace, "E...:T..." on Enterprise
      // Grid — the team id is always its last segment.
      teamId: creds ? (creds.route.split(":").at(-1) ?? null) : null,
    }),
    {
      headers: creds ? { ...cors, "set-cookie": encodeCredsCookie(creds, secure) } : cors,
    },
  );
}
