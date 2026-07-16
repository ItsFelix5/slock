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
const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
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
const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
async function fileProxyResponse(
  fileUrl: string | null,
  creds: Credentials | null,
): Promise<Response> {
  if (!fileUrl) return new Response("missing url", { headers: cors, status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return new Response("invalid url", { headers: cors, status: 400 });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { headers: cors, status: 403 });
  }
  if (!creds) return new Response("not configured", { headers: cors, status: 401 });
  const fileRes = await fetch(parsed, { headers: { cookie: creds.cookie } });
  if (!(fileRes.ok && fileRes.body)) {
    return new Response("failed to fetch file", { headers: cors, status: 502 });
  }
  return new Response(fileRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "cache-control": "private, max-age=3600",
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
    },
  });
}
async function fileUploadProxyResponse(
  body: Uint8Array,
  targetUrl: string | null,
  filename: string | null,
): Promise<Response> {
  if (!targetUrl) return new Response("missing url", { headers: cors, status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("invalid url", { headers: cors, status: 400 });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { headers: cors, status: 403 });
  }
  const form = new FormData();
  form.append("file", new Blob([body]), filename ?? "file");
  const uploadRes = await fetch(parsed, { body: form, method: "POST" });
  return new Response(JSON.stringify({ ok: uploadRes.ok }), {
    headers: cors,
    status: uploadRes.ok ? 200 : 502,
  });
}
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)$/i;
const PRIVATE_172_HOST_RE = /^172\.(\d+)\./;
const TITLE_TAG_RE = /<title[^>]*>([^<]*)<\/title>/i;
const HEAD_END_RE = /<\/head>/i;
function isPrivateHost(hostname: string): boolean {
  if (PRIVATE_HOST_RE.test(hostname)) return true;
  const m = PRIVATE_172_HOST_RE.exec(hostname);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}
function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
}
function parseMetaTags(html: string, base: URL) {
  const og = (prop: string) => [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, "i"),
  ];
  const name = (prop: string) => [
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${prop}["']`, "i"),
  ];
  const title = metaContent(html, og("title")) ?? metaContent(html, [TITLE_TAG_RE]);
  const description = metaContent(html, [...og("description"), ...name("description")]);
  const rawImage = metaContent(html, og("image"));
  const siteName = metaContent(html, og("site_name"));
  let imageUrl: string | undefined;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, base).toString();
    } catch {}
  }
  return { description, imageUrl, siteName, title };
}
async function unfurlResponse(targetUrl: string | null): Promise<Response> {
  if (!targetUrl) return new Response("missing url", { headers: cors, status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("invalid url", { headers: cors, status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("unsupported protocol", { headers: cors, status: 400 });
  }
  if (isPrivateHost(parsed.hostname)) {
    return new Response("host not allowed", { headers: cors, status: 403 });
  }
  try {
    const res = await fetch(parsed, {
      headers: { "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
      signal: AbortSignal.timeout(5000),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!(contentType.includes("html") && res.body)) {
      return new Response(JSON.stringify({ url: targetUrl }), { headers: cors });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 200_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (HEAD_END_RE.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return new Response(JSON.stringify({ url: targetUrl, ...parseMetaTags(html, parsed) }), {
      headers: cors,
    });
  } catch {
    return new Response(JSON.stringify({ url: targetUrl }), { headers: cors });
  }
}
