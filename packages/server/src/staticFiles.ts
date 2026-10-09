import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { acceptsEncoding, headersWithVary, isCompressible } from "./http/compressedResponse";

const ENCODINGS = [
  { encoding: "br", extension: ".br" },
  { encoding: "gzip", extension: ".gz" },
] as const;

const IMMUTABLE = "public, max-age=31536000, immutable";
const ONE_WEEK = "public, max-age=604800";

export function cacheControlFor(pathname: string): string {
  if (pathname.startsWith("/assets/")) return IMMUTABLE;
  if (pathname.startsWith("/public/")) return ONE_WEEK;
  return "no-cache";
}

export function brotli(contents: string | Uint8Array): Uint8Array {
  return brotliCompressSync(contents, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  });
}

export async function writePrecompressed(path: string, contents: Blob): Promise<void> {
  if (!isCompressible(contents.type)) return;
  const bytes = new Uint8Array(await contents.arrayBuffer());
  await Promise.all([
    Bun.write(`${path}.br`, brotli(bytes)),
    Bun.write(`${path}.gz`, gzipSync(bytes, { level: 9 })),
  ]);
}

export async function serveFile(
  path: string,
  pathname: string,
  acceptEncoding: string | null,
): Promise<Response | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return;
  const headers = headersWithVary({
    "cache-control": cacheControlFor(pathname),
    "content-type": file.type,
  });
  if (isCompressible(file.type)) {
    for (const { encoding, extension } of ENCODINGS) {
      if (!acceptsEncoding(acceptEncoding, encoding)) continue;
      const compressed = Bun.file(path + extension);
      if (!(await compressed.exists())) continue;
      headers.set("content-encoding", encoding);
      return new Response(compressed, { headers });
    }
  }
  return new Response(file, { headers });
}
