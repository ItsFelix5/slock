import { type Credentials, cors, slackCookieHeader } from "./relay-core.ts";

const ALLOWED_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
// Only bounds connecting + headers, not the body stream that gets piped
// through afterward — large file downloads/uploads shouldn't get cut off
// mid-transfer, but a stalled upstream that never responds at all should.
const FILE_CONNECT_TIMEOUT_MS = 15_000;

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
  return new Response(fileRes.body, {
    headers: {
      "access-control-allow-origin": cors["access-control-allow-origin"],
      "cache-control": "private, max-age=3600",
      "content-type": fileRes.headers.get("content-type") ?? "application/octet-stream",
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
  form.append("file", new Blob([body]), filename ?? "file");
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
