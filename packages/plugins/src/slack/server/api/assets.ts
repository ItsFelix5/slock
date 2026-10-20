import { isRecord } from "@slock/core";
import { errorMessage } from "../../../http/server/api/errorMessage";
import { type Credentials, jsonHeaders } from "./auth.ts";

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
const SLACK_ASSET_KEY_RE =
  /(?:^|_)(?:avatar|icon|image|thumb|video)(?:_|$)|^url_private(?:_download)?$|^original$|^vtt$/i;

const SLACK_IMGS_KEY_RE = /(?:^|_)(?:avatar|icon|image|thumb)(?:_|$)/i;

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
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return `https://slack-imgs.com/?c=1&o1=ro&url=${encodeURIComponent(value)}`;
}

function hydrateAvatarHash(value: Record<string, unknown>): void {
  const { profile, id } = value;
  if (!(isRecord(profile) && typeof id === "string")) return;
  if (profile.image_192 || profile.image_72 || profile.image_48) return;
  const hash = profile.avatar_hash;
  const team = profile.team ?? value.team_id;
  if (typeof hash !== "string" || typeof team !== "string") return;
  profile.image_192 = `https://ca.slack-edge.com/${team}-${id}-${hash}-192`;
}

export function downloadUrl(url: string): string {
  return isAllowedSlackUrl(url) ? `${ASSET_PATH}?url=${encodeURIComponent(url)}` : url;
}

export function rewriteSlackAssetUrls(value: unknown, creds: Credentials | null): unknown {
  if (!(creds && value) || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => rewriteSlackAssetUrls(entry, creds));
  if (isRecord(value)) hydrateAvatarHash(value);
  const rewritten: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && SLACK_ASSET_KEY_RE.test(key)) {
      if (isAllowedSlackUrl(entry)) {
        rewritten[key] = downloadUrl(entry);
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

async function fetchFollowingRedirects(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  let target = url;
  const { cookie: _cookie, ...anonymousHeaders } = headers;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const res = await fetch(target, {
      decompress: false,
      headers: isAllowedSlackUrl(target) ? headers : anonymousHeaders,
      redirect: "manual",
      signal,
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    target = new URL(location, target).href;
    if (new URL(target).protocol !== "https:")
      throw new Error("Slack file redirected to non-https");
  }
  throw new Error("Slack file redirected too many times");
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

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), FILE_CONNECT_TIMEOUT_MS);
  let fileRes: Response;
  try {
    fileRes = await fetchFollowingRedirects(
      fileUrl,
      {
        cookie: `d=${creds.slackSession}`,
        ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}),
        ...(range ? { range } : {}),
      },
      controller.signal,
    );
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
  const contentRange = fileRes.headers.get("content-range");
  const contentLength = fileRes.headers.get("content-length");
  return new Response(fileRes.body, {
    headers: {
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
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
    const uploadRes = await fetch(uploadUrl, {
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
