import { errorMessage } from "@slock/core";
import { service } from "@slock/core/services";
import { type Credentials, jsonHeaders } from "./auth.ts";

const env = service("env");

export const ASSET_PATH = "/api/assets";

const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];

const INLINE_TYPE_RE =
  /^(?:image\/(?!svg)[\w.+-]+|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/vtt)(?:;|$)/i;

const PLAIN_TEXT_TYPE_RE =
  /^(?:text\/[\w.+-]+|application\/(?:json|xml|javascript|x-yaml|yaml|toml|x-sh|sql)|[\w.-]+\/[\w.-]+\+(?:json|xml))(?:;|$)/i;

export function safeTypeHeaders(type: string | null): Record<string, string> {
  if (type && INLINE_TYPE_RE.test(type))
    return { "content-type": type, "x-content-type-options": "nosniff" };
  if (type && PLAIN_TEXT_TYPE_RE.test(type))
    return { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" };
  return { "content-disposition": "attachment", "content-type": "application/octet-stream" };
}

const FILE_CONNECT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
export const CONTENT_ADDRESSED_HOST_RE = /\.slack-edge\.com$/;

export function isAllowedSlackUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" && ALLOWED_FILE_HOSTS.some((re) => re.test(parsed.hostname))
    );
  } catch {
    return false;
  }
}

function assetCacheControl(url: string): string {
  return CONTENT_ADDRESSED_HOST_RE.test(new URL(url).hostname)
    ? "private, max-age=604800, immutable"
    : "private, max-age=86400, stale-while-revalidate=86400";
}

// Third-party hosts must not go through our asset proxy: it sends the user's Slack cookie upstream
function slackImgsProxyUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return `https://slack-imgs.com/?c=1&o1=ro&url=${encodeURIComponent(value)}`;
}

export function imageUrl(url: string): string {
  return isAllowedSlackUrl(url)
    ? `${ASSET_PATH}?url=${encodeURIComponent(url)}`
    : (slackImgsProxyUrl(url) ?? url);
}

async function fetchFollowingRedirects(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  let target = url;
  const { cookie: _cookie, ...anonymousHeaders } = headers;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const init: RequestInit & { decompress: boolean } = {
      decompress: false,
      headers: isAllowedSlackUrl(target) ? headers : anonymousHeaders,
      redirect: "manual",
      signal,
    };
    const res = await env.fetch(target, init);
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    target = new URL(location, target).href;
    if (new URL(target).protocol !== "https:")
      throw new Error("Slack file redirected to non-https");
  }
  throw new Error("Slack file redirected too many times");
}

const FILE_RETRIES = 1;
const FILE_RETRY_DELAY_MS = 500;

async function fetchFileOnce(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const connectTimer = env.setTimeout(() => controller.abort(), FILE_CONNECT_TIMEOUT_MS);
  try {
    return await fetchFollowingRedirects(url, headers, controller.signal);
  } finally {
    env.clearTimeout(connectTimer);
  }
}

async function fetchFileWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchFileOnce(url, headers);
      if (res.status < 500 || attempt === FILE_RETRIES) return res;
      await res.body?.cancel();
    } catch (error) {
      if (attempt === FILE_RETRIES) throw error;
    }
    await new Promise<void>((resolve) => env.setTimeout(resolve, FILE_RETRY_DELAY_MS));
  }
}

export async function slackAssetResponse(
  fileUrl: string | null,
  creds: Credentials | null,
  acceptEncoding: string | null,
  range: string | null,
): Promise<Response> {
  if (!(fileUrl && isAllowedSlackUrl(fileUrl))) {
    return new Response("not found", { headers: jsonHeaders, status: 404 });
  }
  if (!creds) return new Response("not configured", { headers: jsonHeaders, status: 401 });

  let fileRes: Response;
  try {
    fileRes = await fetchFileWithRetry(fileUrl, {
      cookie: `d=${creds.slackSession}`,
      ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}),
      ...(range ? { range } : {}),
    });
  } catch (error) {
    return new Response(errorMessage(error, "Slack file request failed"), {
      headers: jsonHeaders,
      status: 502,
    });
  }
  if (!(fileRes.ok && fileRes.body)) {
    return new Response(`Slack file request failed: ${fileRes.status} ${fileRes.statusText}`, {
      headers: jsonHeaders,
      status: 502,
    });
  }
  const contentEncoding = fileRes.headers.get("content-encoding");
  const contentRange = fileRes.headers.get("content-range");
  const contentLength = fileRes.headers.get("content-length");
  return new Response(fileRes.body, {
    headers: {
      "accept-ranges": "bytes",
      "cache-control": assetCacheControl(fileUrl),
      ...safeTypeHeaders(fileRes.headers.get("content-type")),
      vary: "Accept-Encoding, Cookie",
      ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
      ...(contentRange ? { "content-range": contentRange } : {}),
      ...(contentLength ? { "content-length": contentLength } : {}),
    },
    status: fileRes.status,
  });
}

export async function slackUploadResponse(
  body: Uint8Array,
  uploadUrl: string | null,
  filename: string | null,
): Promise<Response> {
  if (!(uploadUrl && isAllowedSlackUrl(uploadUrl))) {
    return new Response("not found", { headers: jsonHeaders, status: 404 });
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)]), filename ?? "file");

  try {
    const uploadRes = await env.fetch(uploadUrl, {
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
