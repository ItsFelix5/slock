// The one thing a browser genuinely cannot do itself: Slack's internal API
// needs both an xoxc token *and* a session cookie, and browsers refuse to let
// JS set a `Cookie` header (forbidden by the Fetch spec) — so every Slack
// call has to be relayed through a real server. The Edge Gateway websocket
// needs that same cookie on its handshake, which the browser's native
// WebSocket has no way to attach either, so the real-time connection lives
// here too.
//
// Nothing in this module is global, shared, per-process state — this relay
// is used by many different people at once, each with their own Slack
// credentials, so every function takes `creds` as an argument (read by the
// caller from that one request's own `slock_creds` cookie — see
// parseCredsCookie below) rather than reading a module-level variable. The
// server never stores anyone's credentials beyond the single request or
// live connection it's actively serving; the browser's own httpOnly cookie
// (invisible to page JS, unlike localStorage, so a rendering bug in the rich
// Slack content this app displays can't exfiltrate it) is the only place
// they live.
//
// This module holds no business logic — no endpoint shaping, no response
// mapping. That all lives client-side in @slock/slack-api. It's imported by
// both the dev-time Vite plugin (server/dev-plugin.ts, runs under Node) and
// the production entry point (server/index.ts, runs under Bun), so it only
// uses portable APIs (fetch, the `ws` package) rather than Bun-only globals.
import { WebSocket } from "ws";

export type Credentials = { domain: string; token: string; cookie: string; route: string };

const CREDS_COOKIE = "slock_creds";

// Cookie values can't contain the raw JSON (commas/semicolons/etc are
// unsafe), so it's URI-encoded going in and decoded coming back out.
export function encodeCredsCookie(creds: Credentials, secure: boolean): string {
  const value = encodeURIComponent(JSON.stringify(creds));
  const flags = ["HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=34560000"];
  if (secure) flags.push("Secure");
  return `${CREDS_COOKIE}=${value}; ${flags.join("; ")}`;
}

export function clearCredsCookie(): string {
  return `${CREDS_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

// Every route parses its own creds out of the request it's currently
// handling — nothing is cached or looked up from anywhere else.
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

// Raw Slack API responses are duck-typed `any` throughout this module and
// @slock/slack-api's mappers (never a fixed shape worth declaring) — an
// explicit return type keeps that consistent instead of leaking whatever
// `unknown` the current @types/node fetch typings would otherwise infer.
export async function callSlack(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<any> {
  if (!creds) return { ok: false, error: "not_configured" };
  const body = new URLSearchParams({ token: creds.token, ...params });
  const url = `https://${creds.domain}/api/${method}?slack_route=${encodeURIComponent(creds.route)}&_x_app_name=client`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: creds.cookie,
    },
    body: body.toString(),
  });
  return res.json();
}

const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };

// Pasting a fresh request from devtools is the only way a user gets a
// token/cookie pair in the first place (see parse-auth-request.ts for why
// devtools' copy formats need tolerant parsing). Purely a parse — the
// extracted fields go straight into the response's Set-Cookie header, never
// held onto here, and page JS never sees the raw token/cookie at all.
export async function authResponse(raw: string, secure: boolean): Promise<Response> {
  try {
    const creds = JSON.parse(raw);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "set-cookie": encodeCredsCookie(creds, secure) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't parse that request.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: cors,
    });
  }
}

export function logoutResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, "set-cookie": clearCredsCookie() },
  });
}

export async function slackRelayResponse(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
): Promise<Response> {
  const data = await callSlack(method, params, creds);
  return new Response(JSON.stringify(data), { headers: cors });
}

// Slack's Edge API cache service (a different host from the regular Web API,
// JSON bodies instead of form-encoded) — the official client reads workspace
// data that Enterprise Grid blocks on the Web API from here instead, e.g.
// channel membership, where conversations.members is enterprise_is_restricted.
async function callSlackEdge(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
) {
  if (!creds) return { ok: false, error: "not_configured" };
  const enterpriseId = creds.route.split(":")[0];
  const res = await fetch(`https://edgeapi.slack.com/cache/${enterpriseId}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: creds.cookie },
    body: JSON.stringify({ token: creds.token, ...params }),
  });
  return res.json();
}

export async function slackEdgeRelayResponse(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
): Promise<Response> {
  const data = await callSlackEdge(method, params, creds);
  return new Response(JSON.stringify(data), { headers: cors });
}

// Every route the relay handles, shared by both the production entry point
// (server/index.ts, Bun.serve) and the dev-time Vite plugin (dev-plugin.ts,
// Node's http) — the only thing that differs between them is how a request's
// body gets read, supplied here as `body` so each platform can use its own
// native APIs. Returns null for anything this relay doesn't handle, so the
// caller can fall through to its own static file serving / next().
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

// `chat.getPermalink` is blocked by `enterprise_is_restricted` on Enterprise
// Grid workspaces like this one — the client instead builds permalink URLs
// itself from the workspace domain. Also doubles as the "are we configured"
// check the client uses to decide whether to show the connect-to-slack
// screen instead of the app. Reads only this request's own cookie, so it's
// not server-held state — just decoding what the browser already sent.
export function configResponse(creds: Credentials | null): Response {
  return new Response(
    JSON.stringify({ domain: creds?.domain ?? null, configured: creds !== null }),
    {
      headers: cors,
    },
  );
}

// Slack file URLs require the session cookie the browser never gets — host is
// restricted to Slack's own file/avatar/emoji CDN domains so this can't become
// an open SSRF proxy. Slack's session cookie is SameSite, so it's never sent
// on a cross-site <img>/<video> subresource request anyway — every displayed
// Slack image goes through this proxy now, not just fetchCanvas.
const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];

export async function fileProxyResponse(
  fileUrl: string | null,
  creds: Credentials | null,
): Promise<Response> {
  if (!fileUrl) return new Response("missing url", { status: 400, headers: cors });
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return new Response("invalid url", { status: 400, headers: cors });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { status: 403, headers: cors });
  }
  if (!creds) return new Response("not configured", { status: 401, headers: cors });
  const fileRes = await fetch(parsed, { headers: { cookie: creds.cookie } });
  if (!fileRes.ok || !fileRes.body) {
    return new Response("failed to fetch file", { status: 502, headers: cors });
  }
  return new Response(fileRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}

// Presigned upload URLs don't need the session cookie, but the browser can't
// POST to them directly either — Slack doesn't grant our dev-server origin
// CORS access to files.slack.com, so the raw bytes come to us first (a normal
// same-origin request) and we relay them server-side, where CORS doesn't apply.
export async function fileUploadProxyResponse(
  body: Uint8Array,
  targetUrl: string | null,
  filename: string | null,
): Promise<Response> {
  if (!targetUrl) return new Response("missing url", { status: 400, headers: cors });
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("invalid url", { status: 400, headers: cors });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { status: 403, headers: cors });
  }
  const form = new FormData();
  form.append("file", new Blob([body]), filename ?? "file");
  const uploadRes = await fetch(parsed, { method: "POST", body: form });
  return new Response(JSON.stringify({ ok: uploadRes.ok }), {
    status: uploadRes.ok ? 200 : 502,
    headers: cors,
  });
}

// Loopback/private-range hosts a pasted link could point at internally —
// blocked so the unfurl proxy below can't be turned into an SSRF probe of
// the server's own network.
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)$/i;
function isPrivateHost(hostname: string): boolean {
  if (PRIVATE_HOST_RE.test(hostname)) return true;
  const m = /^172\.(\d+)\./.exec(hostname);
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
  return undefined;
}

// Both attribute orderings show up in the wild (property-then-content and
// content-then-property), so each og:/name= tag needs both regexes tried.
function parseMetaTags(html: string, base: URL) {
  const og = (prop: string) => [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, "i"),
  ];
  const name = (prop: string) => [
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${prop}["']`, "i"),
  ];
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i;

  const title = metaContent(html, og("title")) ?? metaContent(html, [titleTag]);
  const description = metaContent(html, [...og("description"), ...name("description")]);
  const rawImage = metaContent(html, og("image"));
  const siteName = metaContent(html, og("site_name"));

  let imageUrl: string | undefined;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, base).toString();
    } catch {
      // malformed og:image URL; drop it rather than surfacing garbage
    }
  }
  return { title, description, imageUrl, siteName };
}

// Best-effort Open Graph/meta-tag scraper for the composer's link preview.
// This stands in for Slack's own unfurl (which only ever runs server-side
// after a message is actually posted) — there's no documented endpoint for
// previewing an arbitrary link client-side, so this fetches the page itself.
export async function unfurlResponse(targetUrl: string | null): Promise<Response> {
  if (!targetUrl) return new Response("missing url", { status: 400, headers: cors });
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("invalid url", { status: 400, headers: cors });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("unsupported protocol", { status: 400, headers: cors });
  }
  if (isPrivateHost(parsed.hostname)) {
    return new Response("host not allowed", { status: 403, headers: cors });
  }
  try {
    const res = await fetch(parsed, {
      headers: { "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
      signal: AbortSignal.timeout(5000),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") || !res.body) {
      return new Response(JSON.stringify({ url: targetUrl }), { headers: cors });
    }
    // Only <head> ever holds the meta tags we care about, and pages can be
    // arbitrarily large, so stop reading once it closes (or past a sane cap).
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 200_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return new Response(JSON.stringify({ url: targetUrl, ...parseMetaTags(html, parsed) }), {
      headers: cors,
    });
  } catch {
    return new Response(JSON.stringify({ url: targetUrl }), { headers: cors });
  }
}

// ---------------------------------------------------------------------------
// Real-time relay: connect to Slack's own Edge Gateway websocket server-side
// (the only way to attach the session cookie) and fan its events out to every
// connected browser client. Classic rtm.connect is permanently unavailable on
// Enterprise Grid workspaces like this one, so we speak the same protocol the
// official web/desktop client uses instead. If the gateway connection is
// down, fall back to polling Slack ourselves.
// ---------------------------------------------------------------------------

export type ClientSocket = { send(data: string): void };

// Everything below used to be one set of module-level globals shared by
// every connected browser — one gateway socket, one watch list, fanned out
// to a shared `clients` Set. That's wrong once more than one person can be
// connected at once: each browser gets its own dedicated Slack Edge Gateway
// connection and its own watch list, scoped to that one /ws connection and
// torn down when it closes. Events go straight back to the one browser they
// came from, so there's no fan-out/broadcast step anymore either.
type ConnectionState = {
  creds: Credentials;
  socket: ClientSocket;
  gatewaySocket: WebSocket | null;
  gatewayConnected: boolean;
  gatewayRetryDelay: number;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  watchedChannels: Set<string>;
  watchedThreads: Map<string, string>; // ts -> channel
  closed: boolean;
};

const connections = new WeakMap<ClientSocket, ConnectionState>();
const GATEWAY_MAX_RETRY_DELAY = 60000;

function send(state: ConnectionState, payload: unknown) {
  try {
    state.socket.send(JSON.stringify(payload));
  } catch {
    // dropped client; the close handler will clean it up
  }
}

function sendStatus(state: ConnectionState) {
  send(state, { type: "_status", connected: state.gatewayConnected });
}

export function statusMessage(connected: boolean): string {
  return JSON.stringify({ type: "_status", connected });
}

function startFallbackPolling(state: ConnectionState) {
  if (state.fallbackTimer) return;
  state.fallbackTimer = setInterval(async () => {
    for (const channel of state.watchedChannels) {
      try {
        const data = await callSlack(
          "conversations.history",
          { channel, limit: "60" },
          state.creds,
        );
        if (data.ok)
          send(state, { type: "_history_snapshot", channel, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
    for (const [ts, channel] of state.watchedThreads) {
      try {
        const data = await callSlack(
          "conversations.replies",
          { channel, ts, limit: "200" },
          state.creds,
        );
        if (data.ok)
          send(state, { type: "_replies_snapshot", channel, ts, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
  }, 4000);
}

function stopFallbackPolling(state: ConnectionState) {
  if (state.fallbackTimer) {
    clearInterval(state.fallbackTimer);
    state.fallbackTimer = null;
  }
}

// Slack's Enterprise Grid gateway addresses the "org-wide" connection by a team id
// that mirrors the enterprise id with its leading "E" swapped for "T" — not
// documented anywhere, found by inspecting the official client's own websocket
// handshake in devtools.
function buildGatewayUrl(current: Credentials) {
  const enterpriseId = current.route.split(":")[0];
  const gatewayTeamId = `T${enterpriseId.slice(1)}`;
  const shard = 1 + Math.floor(Math.random() * 3);
  const params = new URLSearchParams({
    token: current.token,
    sync_desync: "1",
    slack_client: "desktop",
    start_args: `?agent=client&org_wide_aware=true&agent_version=${Date.now()}&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true`,
    no_query_on_subscribe: "1",
    flannel: "3",
    lazy_channels: "1",
    gateway_server: `${gatewayTeamId}-${shard}`,
    enterprise_id: enterpriseId,
    batch_presence_aware: "1",
  });
  return `wss://wss-primary.slack.com/?${params}`;
}

function connectGateway(state: ConnectionState) {
  if (state.closed) return;
  try {
    const socket = new WebSocket(buildGatewayUrl(state.creds), {
      headers: { cookie: state.creds.cookie },
    });
    state.gatewaySocket = socket;

    socket.addEventListener("open", () => {
      console.log("Connected to Slack Edge gateway");
      state.gatewayConnected = true;
      state.gatewayRetryDelay = 2000;
      stopFallbackPolling(state);
      sendStatus(state);
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== "pong" && payload.type !== "reconnect_url")
          send(state, payload);
      } catch {
        // ignore malformed frames
      }
    });

    const onDown = () => {
      if (state.gatewaySocket !== socket) return;
      state.gatewaySocket = null;
      state.gatewayConnected = false;
      sendStatus(state);
      if (state.closed) return;
      startFallbackPolling(state);
      setTimeout(() => connectGateway(state), state.gatewayRetryDelay);
      state.gatewayRetryDelay = Math.min(state.gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
    };
    socket.addEventListener("close", onDown);
    socket.addEventListener("error", onDown);

    const pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: "ping", id: Date.now() }));
      } catch {
        clearInterval(pingTimer);
      }
    }, 30000);
    socket.addEventListener("close", () => clearInterval(pingTimer));
  } catch (err) {
    console.warn("Failed to connect to Slack gateway, retrying:", err);
    if (state.closed) return;
    startFallbackPolling(state);
    setTimeout(() => connectGateway(state), state.gatewayRetryDelay);
    state.gatewayRetryDelay = Math.min(state.gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  }
}

// Called once a browser's /ws connection opens, with credentials already
// parsed from that same upgrade request's own cookie — nothing is looked up
// or restored from anywhere else. A connection with no creds just sits idle
// (shouldn't happen in practice: the client only opens /ws once configured).
export function handleClientOpen(socket: ClientSocket, creds: Credentials | null): void {
  if (!creds) return;
  const state: ConnectionState = {
    creds,
    socket,
    gatewaySocket: null,
    gatewayConnected: false,
    gatewayRetryDelay: 2000,
    fallbackTimer: null,
    watchedChannels: new Set(),
    watchedThreads: new Map(),
    closed: false,
  };
  connections.set(socket, state);
  connectGateway(state);
}

// Tears down everything scoped to this one connection — its dedicated
// gateway socket, its fallback-poll timer — so nothing outlives the browser
// tab that opened it.
export function handleClientDisconnect(socket: ClientSocket): void {
  const state = connections.get(socket);
  if (!state) return;
  state.closed = true;
  state.gatewaySocket?.close();
  stopFallbackPolling(state);
  connections.delete(socket);
}

export function handleClientMessage(raw: string, socket: ClientSocket): void {
  const state = connections.get(socket);
  if (!state) return;
  try {
    const msg = JSON.parse(raw);
    if (msg.type === "watch_channel" && msg.channel) state.watchedChannels.add(msg.channel);
    else if (msg.type === "unwatch_channel" && msg.channel)
      state.watchedChannels.delete(msg.channel);
    else if (msg.type === "watch_thread" && msg.channel && msg.ts)
      state.watchedThreads.set(msg.ts, msg.channel);
    else if (msg.type === "unwatch_thread" && msg.ts) state.watchedThreads.delete(msg.ts);
  } catch {
    // ignore malformed client frames
  }
}
