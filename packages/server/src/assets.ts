import { createHmac, timingSafeEqual } from "node:crypto";
import { type Credentials, jsonHeaders, slackCookieHeader } from "./auth.ts";
import { errorMessage } from "./http/errorMessage.ts";

const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];

const FILE_CONNECT_TIMEOUT_MS = 15_000;
const SLACK_ASSET_KEY_RE =
  /(?:^|_)(?:avatar|icon|image|thumb|video)(?:_|$)|^url_private(?:_download)?$|^original$|^vtt$/i;

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

async function slackFileResponse(
  fileUrl: string,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return new Response("invalid url", { headers: jsonHeaders, status: 400 });
  }
  if (!ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return new Response("host not allowed", {
      headers: jsonHeaders,
      status: 403,
    });
  }
  if (!creds)
    return new Response("not configured", {
      headers: jsonHeaders,
      status: 401,
    });

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), FILE_CONNECT_TIMEOUT_MS);
  let fileRes: Response;
  try {
    fileRes = await fetch(parsed, {
      decompress: false,
      headers: {
        cookie: slackCookieHeader(creds),
        ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    return new Response(errorMessage(error, "Slack file request failed"), {
      headers: jsonHeaders,
      status: 502,
    });
  } finally {
    clearTimeout(connectTimer);
  }
  if (!(fileRes.ok && fileRes.body)) {
    return new Response(`Slack file request failed: ${fileRes.status} ${fileRes.statusText}`, {
      headers: jsonHeaders,
      status: 502,
    });
  }
  const contentEncoding = fileRes.headers.get("content-encoding");
  return new Response(fileRes.body, {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
      vary: "Accept-Encoding",
      ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
    },
  });
}

export function slackAssetResponse(
  capability: string | null,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  if (!(capability && creds)) {
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  }
  const url = readCapability(capability, "download", creds);
  if (!url)
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  return slackFileResponse(url, creds, acceptEncoding);
}

export function namedSlackAssetResponse(
  fileUrl: string | null,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  if (!fileUrl) {
    return Promise.resolve(new Response("not found", { headers: jsonHeaders, status: 404 }));
  }
  return slackFileResponse(fileUrl, creds, acceptEncoding);
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
    return new Response("host not allowed", {
      headers: jsonHeaders,
      status: 403,
    });
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)]), filename ?? "file");

  try {
    const uploadRes = await fetch(parsed, {
      body: form,
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    return new Response(
      JSON.stringify({
        error: uploadRes.ok
          ? undefined
          : `Slack file upload failed: ${uploadRes.status} ${uploadRes.statusText}`,
        ok: uploadRes.ok,
      }),
      {
        headers: jsonHeaders,
        status: uploadRes.ok ? 200 : 502,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: errorMessage(error, "Slack file upload failed"),
        ok: false,
      }),
      {
        headers: jsonHeaders,
        status: 502,
      },
    );
  }
}
