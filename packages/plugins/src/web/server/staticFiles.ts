import { isCompressible } from "@slock/installer/compressible";
import { acceptsEncoding, headersWithVary } from "@slock/plugins/http/server/api/compression";

const ENCODINGS = [
  { encoding: "br", extension: ".br" },
  { encoding: "gzip", extension: ".gz" },
] as const;

const IMMUTABLE = "public, max-age=31536000, immutable";
const ONE_WEEK = "public, max-age=604800";

function cacheControlFor(pathname: string): string {
  if (pathname.startsWith("/assets/")) return IMMUTABLE;
  if (pathname.startsWith("/public/fonts/")) return IMMUTABLE;
  if (pathname.startsWith("/public/")) return ONE_WEEK;
  return "no-cache";
}

export async function serveFile(
  path: string,
  pathname: string,
  requestHeaders: Headers,
): Promise<Response | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return;
  const headers = headersWithVary({
    "cache-control": cacheControlFor(pathname),
    "content-type": file.type,
  });
  let body = file;
  if (isCompressible(file.type)) {
    const acceptEncoding = requestHeaders.get("accept-encoding");
    for (const { encoding, extension } of ENCODINGS) {
      if (!acceptsEncoding(acceptEncoding, encoding)) continue;
      const compressed = Bun.file(path + extension);
      if (!(await compressed.exists())) continue;
      headers.set("content-encoding", encoding);
      body = compressed;
      break;
    }
  }
  const etag = `"${body.size}-${body.lastModified}"`;
  headers.set("etag", etag);
  if (requestHeaders.get("if-none-match") === etag) {
    headers.delete("content-encoding");
    return new Response(null, { headers, status: 304 });
  }
  return new Response(body, { headers });
}
