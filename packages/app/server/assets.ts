import { createHmac, timingSafeEqual } from "node:crypto";
import { type Credentials, jsonHeaders, slackCookieHeader } from "./auth.ts";

const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
// Only bounds connecting + headers, not the body stream that gets piped
// through afterward — large file downloads/uploads shouldn't get cut off
// mid-transfer, but a stalled upstream that never responds at all should.
const FILE_CONNECT_TIMEOUT_MS = 15_000;
const SLACK_ASSET_KEY_RE =
  /(?:^|_)(?:avatar|icon|image|thumb|video)(?:_|$)|^url_private(?:_download)?$|^original$/i;
// Excludes "video": slack-imgs.com is an image proxy, so third-party unfurl
// videos are left as direct links rather than passed through it.
const SLACK_IMGS_KEY_RE = /(?:^|_)(?:avatar|icon|image|thumb)(?:_|$)/i;

type CapabilityPurpose = "download" | "upload";

function capabilitySignature(encodedUrl: string, purpose: CapabilityPurpose, creds: Credentials) {
  return createHmac("sha256", `${creds.token}\0${creds.slackSession}`)
    .update(`${purpose}\0${encodedUrl}`)
    .digest("base64url");
}

function createCapability(url: string, purpose: CapabilityPurpose, creds: Credentials): string {
  const encodedUrl = Buffer.from(url).toString("base64url");
  return `${encodedUrl}.${capabilitySignature(encodedUrl, purpose, creds)}`;
}

function readCapability(
  capability: string,
  purpose: CapabilityPurpose,
  creds: Credentials,
): string | null {
  if (capability.length > 16_384) return null;
  const separator = capability.lastIndexOf(".");
  if (separator <= 0) return null;
  const encodedUrl = capability.slice(0, separator);
  const provided = Buffer.from(capability.slice(separator + 1), "base64url");
  const expected = Buffer.from(capabilitySignature(encodedUrl, purpose, creds), "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    return Buffer.from(encodedUrl, "base64url").toString();
  } catch {
    return null;
  }
}

function isAllowedSlackUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" && ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))
    );
  } catch {
    return false;
  }
}

// Third-party unfurl/attachment images (e.g. a link preview's image_url)
// aren't behind Slack's cookie, so they don't need our signed fetch-through
// proxy — routing them there would also leak the user's Slack session cookie
// to an arbitrary external host. Slack's own client instead hands these to
// its public slack-imgs.com image proxy, which we mirror here.
function slackImgsProxyUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return `https://slack-imgs.com/?c=1&o1=ro&url=${encodeURIComponent(value)}`;
}

export function rewriteSlackAssetUrls(value: unknown, creds: Credentials | null): unknown {
  if (!(creds && value) || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => rewriteSlackAssetUrls(entry, creds));
  const rewritten: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && SLACK_ASSET_KEY_RE.test(key)) {
      if (isAllowedSlackUrl(entry)) {
        rewritten[key] = `/api/assets/${createCapability(entry, "download", creds)}`;
        continue;
      }
      if (SLACK_IMGS_KEY_RE.test(key)) {
        const proxied = slackImgsProxyUrl(entry);
        if (proxied) {
          rewritten[key] = proxied;
          continue;
        }
      }
    }
    rewritten[key] = rewriteSlackAssetUrls(entry, creds);
  }
  return rewritten;
}

async function slackFileResponse(fileUrl: string, creds: Credentials | null): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return new Response("invalid url", { headers: jsonHeaders, status: 400 });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { headers: jsonHeaders, status: 403 });
  }
  if (!creds) return new Response("not configured", { headers: jsonHeaders, status: 401 });
  // Aborts only if upstream never responds at all; cleared once headers land
  // so a slow-but-streaming download isn't cut off mid-transfer.
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), FILE_CONNECT_TIMEOUT_MS);
  let fileRes: Response;
  try {
    fileRes = await fetch(parsed, {
      decompress: false,
      headers: { cookie: slackCookieHeader(creds) },
      signal: controller.signal,
    });
  } catch {
    return new Response("failed to fetch file", { headers: jsonHeaders, status: 502 });
  } finally {
    clearTimeout(connectTimer);
  }
  if (!(fileRes.ok && fileRes.body)) {
    return new Response("failed to fetch file", { headers: jsonHeaders, status: 502 });
  }
  const contentEncoding = fileRes.headers.get("content-encoding");
  return new Response(fileRes.body, {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
      ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
    },
  });
}

export function slackAssetResponse(
  capability: string | null,
  creds: Credentials | null,
): Promise<Response> {
  if (!(capability && creds)) {
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  }
  const url = readCapability(capability, "download", creds);
  if (!url)
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  return slackFileResponse(url, creds);
}

export function namedSlackAssetResponse(
  fileUrl: string | null,
  creds: Credentials | null,
): Promise<Response> {
  if (!fileUrl) {
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  }
  return slackFileResponse(fileUrl, creds);
}

export function uploadCapability(uploadUrl: string, creds: Credentials): string | null {
  return isAllowedSlackUrl(uploadUrl) ? createCapability(uploadUrl, "upload", creds) : null;
}

export async function slackUploadResponse(
  body: Uint8Array,
  capability: string | null,
  filename: string | null,
  creds: Credentials | null,
): Promise<Response> {
  if (!(capability && creds))
    return new Response("not found", { headers: jsonHeaders, status: 404 });
  const targetUrl = readCapability(capability, "upload", creds);
  if (!targetUrl) return new Response("not found", { headers: jsonHeaders, status: 404 });
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("invalid url", { headers: jsonHeaders, status: 400 });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", { headers: jsonHeaders, status: 403 });
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)]), filename ?? "file");
  // Unlike the download side, the whole upload (send + response) happens
  // inside this one fetch() call, so the timeout has to cover the full
  // transfer rather than just connecting.
  try {
    const uploadRes = await fetch(parsed, {
      body: form,
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    return new Response(JSON.stringify({ ok: uploadRes.ok }), {
      headers: jsonHeaders,
      status: uploadRes.ok ? 200 : 502,
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { headers: jsonHeaders, status: 502 });
  }
}
