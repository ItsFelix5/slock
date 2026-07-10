// The one thing a browser genuinely cannot do itself: Slack's internal API
// needs both an xoxc token *and* a session cookie, and browsers refuse to let
// JS set a `Cookie` header (forbidden by the Fetch spec) — so every Slack
// call has to be relayed through a real server. The Edge Gateway websocket
// needs that same cookie on its handshake, which the browser's native
// WebSocket has no way to attach either, so the real-time connection lives
// here too, fanned out to connected browser clients.
//
// This module holds no business logic — no endpoint shaping, no response
// mapping. That all lives client-side in @slock/slack-api. It's imported by
// both the dev-time Vite plugin (server/dev-plugin.ts, runs under Node) and
// the production entry point (server/index.ts, runs under Bun), so it only
// uses portable APIs (fetch, the `ws` package, node:fs) rather than Bun-only
// globals.
import { readFile, writeFile } from "node:fs/promises";
import { WebSocket } from "ws";
import { parseDevtoolsRequest } from "./parse-auth-request";

type Credentials = { domain: string; token: string; cookie: string; route: string };

function loadCredentialsFromEnv(): Credentials | null {
  const { SLACK_DOMAIN, SLACK_TOKEN, SLACK_COOKIE, SLACK_ROUTE } = process.env;
  if (!SLACK_DOMAIN || !SLACK_TOKEN || !SLACK_COOKIE || !SLACK_ROUTE) return null;
  return { domain: SLACK_DOMAIN, token: SLACK_TOKEN, cookie: SLACK_COOKIE, route: SLACK_ROUTE };
}

let creds: Credentials | null = loadCredentialsFromEnv();

export function isConfigured(): boolean {
  return creds !== null;
}

// Repo-root .env — this file lives at packages/app/server/, so three levels up.
const ENV_PATH = `${import.meta.dir}/../../../.env`;

async function persistCredentials(next: Credentials) {
  const lines: Record<string, string> = {};
  try {
    const text = await readFile(ENV_PATH, "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) lines[match[1]] = match[2];
    }
  } catch {
    // no existing .env; write a fresh one
  }
  lines.SLACK_DOMAIN = next.domain;
  lines.SLACK_TOKEN = next.token;
  lines.SLACK_COOKIE = `"${next.cookie}"`;
  lines.SLACK_ROUTE = next.route;
  const text = `${Object.entries(lines)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
  await writeFile(ENV_PATH, text);
}

// Pasting a fresh request from devtools is the only way a user gets a
// token/cookie pair in the first place (see parse-auth-request.ts for why
// devtools' copy formats need tolerant parsing). Reconnects the gateway with
// the new credentials immediately so re-authing after a stale cookie doesn't
// need a server restart.
export async function setCredentialsFromDevtoolsRequest(raw: string): Promise<void> {
  const next = parseDevtoolsRequest(raw);
  creds = next;
  await persistCredentials(next);
  gatewaySocket?.close();
  gatewaySocket = null;
  gatewayRetryDelay = 2000;
  connectGateway();
}

export async function callSlack(method: string, params: Record<string, string> = {}) {
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

export async function authResponse(raw: string): Promise<Response> {
  try {
    await setCredentialsFromDevtoolsRequest(raw);
    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't parse that request.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: cors,
    });
  }
}

export async function slackRelayResponse(
  method: string,
  params: Record<string, string>,
): Promise<Response> {
  const data = await callSlack(method, params);
  return new Response(JSON.stringify(data), { headers: cors });
}

// Slack's Edge API cache service (a different host from the regular Web API,
// JSON bodies instead of form-encoded) — the official client reads workspace
// data that Enterprise Grid blocks on the Web API from here instead, e.g.
// channel membership, where conversations.members is enterprise_is_restricted.
async function callSlackEdge(method: string, params: Record<string, unknown>) {
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
): Promise<Response> {
  const data = await callSlackEdge(method, params);
  return new Response(JSON.stringify(data), { headers: cors });
}

// `chat.getPermalink` is blocked by `enterprise_is_restricted` on Enterprise
// Grid workspaces like this one — the client instead builds permalink URLs
// itself from the workspace domain, which only the server knows (env-only).
// Also doubles as the "are we configured" check the client uses to decide
// whether to show the connect-to-slack screen instead of the app.
export function configResponse(): Response {
  return new Response(
    JSON.stringify({ domain: creds?.domain ?? null, configured: creds !== null }),
    { headers: cors },
  );
}

// Slack file URLs require the session cookie the browser never gets — host is
// restricted to Slack's own file domains so this can't become an open SSRF proxy.
const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/];

export async function fileProxyResponse(fileUrl: string | null): Promise<Response> {
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
export const clients = new Set<ClientSocket>();
let gatewayConnected = false;
export function isGatewayConnected() {
  return gatewayConnected;
}

const watchedChannels = new Set<string>();
const watchedThreads = new Map<string, string>();

export function watchChannel(channel: string) {
  watchedChannels.add(channel);
}
export function unwatchChannel(channel: string) {
  watchedChannels.delete(channel);
}
export function watchThread(channel: string, ts: string) {
  watchedThreads.set(ts, channel);
}
export function unwatchThread(ts: string) {
  watchedThreads.delete(ts);
}

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      // dropped client; the close handler will clean it up
    }
  }
}

function broadcastStatus() {
  broadcast({ type: "_status", connected: gatewayConnected });
}

export function statusMessage(): string {
  return JSON.stringify({ type: "_status", connected: gatewayConnected });
}

let gatewaySocket: WebSocket | null = null;
let gatewayRetryDelay = 2000;
const GATEWAY_MAX_RETRY_DELAY = 60000;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

function startFallbackPolling() {
  if (fallbackTimer) return;
  fallbackTimer = setInterval(async () => {
    for (const channel of watchedChannels) {
      try {
        const data = await callSlack("conversations.history", { channel, limit: "60" });
        if (data.ok)
          broadcast({ type: "_history_snapshot", channel, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
    for (const [ts, channel] of watchedThreads) {
      try {
        const data = await callSlack("conversations.replies", { channel, ts, limit: "200" });
        if (data.ok)
          broadcast({ type: "_replies_snapshot", channel, ts, messages: data.messages ?? [] });
      } catch {
        // transient network error; next tick retries
      }
    }
  }, 4000);
}

function stopFallbackPolling() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
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

function connectGateway() {
  if (!creds) return;
  const current = creds;
  try {
    const socket = new WebSocket(buildGatewayUrl(current), { headers: { cookie: current.cookie } });
    gatewaySocket = socket;

    socket.addEventListener("open", () => {
      console.log("Connected to Slack Edge gateway");
      gatewayConnected = true;
      gatewayRetryDelay = 2000;
      stopFallbackPolling();
      broadcastStatus();
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type && payload.type !== "pong" && payload.type !== "reconnect_url")
          broadcast(payload);
      } catch {
        // ignore malformed frames
      }
    });

    const onDown = () => {
      if (gatewaySocket !== socket) return;
      gatewaySocket = null;
      gatewayConnected = false;
      broadcastStatus();
      startFallbackPolling();
      setTimeout(connectGateway, gatewayRetryDelay);
      gatewayRetryDelay = Math.min(gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
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
    startFallbackPolling();
    setTimeout(connectGateway, gatewayRetryDelay);
    gatewayRetryDelay = Math.min(gatewayRetryDelay * 2, GATEWAY_MAX_RETRY_DELAY);
  }
}

let started = false;
export function startGateway() {
  if (started) return;
  started = true;
  if (creds) connectGateway();
}

export function handleClientMessage(raw: string) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === "watch_channel" && msg.channel) watchChannel(msg.channel);
    else if (msg.type === "unwatch_channel" && msg.channel) unwatchChannel(msg.channel);
    else if (msg.type === "watch_thread" && msg.channel && msg.ts) watchThread(msg.channel, msg.ts);
    else if (msg.type === "unwatch_thread" && msg.ts) unwatchThread(msg.ts);
  } catch {
    // ignore malformed client frames
  }
}
