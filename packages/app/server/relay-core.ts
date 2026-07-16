import { fileProxyResponse, fileUploadProxyResponse } from "./relay-files.ts";
import { unfurlResponse } from "./relay-unfurl.ts";

export type Credentials = { domain: string; token: string; cookie: string; route: string };
const CREDS_COOKIE = "slock_creds";
function encodeCredsCookie(creds: Credentials, secure: boolean): string {
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
      if (parsed?.domain && parsed.token && parsed.cookie && parsed.route) return parsed;
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
      cookie: creds.cookie,
    },
    method: "POST",
  });
  return parseSlackResponse(res);
}
export const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
function authResponse(raw: string, secure: boolean): Response {
  try {
    const creds = JSON.parse(raw);
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
  const enterpriseId = creds.route.split(":")[0];
  const auth = method === "users/info" ? { enterprise_token: creds.token } : {};
  const res = await fetch(`https://edgeapi.slack.com/cache/${enterpriseId}/${method}`, {
    body: JSON.stringify({ token: creds.token, ...auth, ...params }),
    headers: { "content-type": "application/json", cookie: creds.cookie },
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
    return configResponse(creds);
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
function configResponse(creds: Credentials | null): Response {
  return new Response(
    JSON.stringify({ configured: creds !== null, domain: creds?.domain ?? null }),
    {
      headers: cors,
    },
  );
}
