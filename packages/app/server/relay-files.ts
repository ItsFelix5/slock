import { type Credentials, cors, slackCookieHeader } from "./relay-auth.ts";

const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
// Only bounds connecting + headers, not the body stream that gets piped
// through afterward — large file downloads/uploads shouldn't get cut off
// mid-transfer, but a stalled upstream that never responds at all should.
const FILE_CONNECT_TIMEOUT_MS = 15_000;
const MEDIA_CONNECT_TIMEOUT_MS = 8_000;
const MEDIA_CONTENT_TYPE_RE = /^(image|video)\//;
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)$/i;
const PRIVATE_172_HOST_RE = /^172\.(\d+)\./;

// Any endpoint that fetches a caller-supplied URL server-side (this proxy,
// relay-unfurl's link previews) must reject internal/link-local addresses
// first, or it becomes an SSRF vector into this host's own network.
export function isPrivateHost(hostname: string): boolean {
  if (PRIVATE_HOST_RE.test(hostname)) return true;
  const m = PRIVATE_172_HOST_RE.exec(hostname);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

export async function fileProxyResponse(
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
    return new Response("failed to fetch file", { headers: cors, status: 502 });
  } finally {
    clearTimeout(connectTimer);
  }
  if (!(fileRes.ok && fileRes.body)) {
    return new Response("failed to fetch file", { headers: cors, status: 502 });
  }
  const contentEncoding = fileRes.headers.get("content-encoding");
  return new Response(fileRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "cache-control": "private, max-age=3600",
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
      ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
    },
  });
}

export async function fileUploadProxyResponse(
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
      headers: cors,
      status: uploadRes.ok ? 200 : 502,
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { headers: cors, status: 502 });
  }
}

// Legacy/bot message attachments (author icon, footer icon, image_url) can
// point at arbitrary third-party hosts — e.g. GitHub's integration footer
// icon lives at slack.github.com, which sends
// `Cross-Origin-Resource-Policy: same-origin`. That header blocks the
// browser from loading it as a direct <img> hotlink no matter what CORS
// headers say. Slack's own client works around this by routing such images
// through its internal image proxy (slack-imgs.com); we don't have access to
// that infra, so this fetches the media server-side instead. Unlike
// fileProxyResponse above, this is unauthenticated (no Slack cookie — never
// send that to a non-Slack host) and open to any public host, so it's
// restricted to SSRF-safe targets and image/video content only.
export async function externalMediaProxyResponse(
  mediaUrl: string | null,
  fetchMedia: (
    input: URL,
    init?: RequestInit & { decompress?: boolean },
  ) => Promise<Response> = fetch,
): Promise<Response> {
  if (!mediaUrl) return new Response("missing url", { headers: cors, status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return new Response("invalid url", { headers: cors, status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("unsupported protocol", { headers: cors, status: 400 });
  }
  if (isPrivateHost(parsed.hostname)) {
    return new Response("host not allowed", { headers: cors, status: 403 });
  }
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), MEDIA_CONNECT_TIMEOUT_MS);
  let mediaRes: Response;
  try {
    mediaRes = await fetchMedia(parsed, {
      decompress: false,
      headers: {
        // Node-compatible fetch implementations transparently decompress the
        // response body but can leave the upstream Content-Encoding header in
        // place. Ask for the original bytes so the response never becomes an
        // already-decoded PNG mislabeled as Brotli/zstd on its way to the browser.
        "accept-encoding": "identity",
        "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      },
      signal: controller.signal,
    });
  } catch {
    return new Response("failed to fetch media", { headers: cors, status: 502 });
  } finally {
    clearTimeout(connectTimer);
  }
  const contentType = mediaRes.headers.get("content-type") ?? "";
  if (!(mediaRes.ok && mediaRes.body && MEDIA_CONTENT_TYPE_RE.test(contentType))) {
    return new Response("failed to fetch media", { headers: cors, status: 502 });
  }
  return new Response(mediaRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "cache-control": "public, max-age=3600",
      "content-type": contentType,
    },
  });
}
