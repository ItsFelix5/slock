import { cors } from "./relay-core.ts";

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
export async function unfurlResponse(targetUrl: string | null): Promise<Response> {
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
