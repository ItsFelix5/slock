import { promisify } from "node:util";
import {
  brotliCompress as brotliCompressCallback,
  constants,
  gzip as gzipCallback,
} from "node:zlib";

const gzip = promisify(gzipCallback);
const brotliCompress = promisify(brotliCompressCallback);
const MIN_COMPRESSIBLE_BYTES = 1024;
const BROTLI_QUALITY = 4;

const COMPRESSIBLE_CONTENT_TYPE_RE =
  /^(?:text\/|application\/(?:javascript|json|xml|wasm)|image\/svg\+xml)/i;

export function acceptsEncoding(acceptEncoding: string | null, wanted: "gzip" | "br"): boolean {
  return Boolean(
    acceptEncoding?.split(",").some((part) => {
      const [encoding, ...parameters] = part.trim().toLowerCase().split(";");
      return encoding === wanted && !parameters.some((parameter) => parameter.trim() === "q=0");
    }),
  );
}

export function headersWithVary(headers: Headers | Record<string, string>): Headers {
  const result = new Headers(headers);
  const vary = result.get("vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "accept-encoding")) {
    result.set("vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  }
  return result;
}

export function isCompressible(contentType: string | null): boolean {
  return Boolean(!contentType || COMPRESSIBLE_CONTENT_TYPE_RE.test(contentType));
}

function encode(bytes: ArrayBuffer, encoding: "br" | "gzip"): Promise<Buffer> {
  return encoding === "br"
    ? brotliCompress(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
    : gzip(bytes);
}

export async function compressResponse(
  response: Response,
  acceptEncoding: string | null,
): Promise<Response> {
  if (
    !response.body ||
    response.headers.has("content-encoding") ||
    !isCompressible(response.headers.get("content-type"))
  ) {
    return response;
  }
  const headers = headersWithVary(response.headers);
  const encoding = (["br", "gzip"] as const).find((wanted) =>
    acceptsEncoding(acceptEncoding, wanted),
  );
  const init = { headers, status: response.status, statusText: response.statusText };
  if (!encoding) return new Response(response.body, init);
  const bytes = await response.arrayBuffer();
  headers.delete("content-length");
  if (bytes.byteLength < MIN_COMPRESSIBLE_BYTES) return new Response(bytes, init);
  headers.set("content-encoding", encoding);
  return new Response(new Uint8Array(await encode(bytes, encoding)), init);
}
