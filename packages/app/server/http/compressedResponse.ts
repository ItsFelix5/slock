import { gzipSync } from "node:zlib";

const COMPRESSIBLE_CONTENT_TYPE_RE =
  /^(?:text\/|application\/(?:javascript|json|xml|wasm)|image\/svg\+xml)/i;

function acceptsGzip(acceptEncoding: string | null): boolean {
  return Boolean(
    acceptEncoding?.split(",").some((part) => {
      const [encoding, ...parameters] = part.trim().toLowerCase().split(";");
      return encoding === "gzip" && !parameters.some((parameter) => parameter.trim() === "q=0");
    }),
  );
}

function headersWithVary(headers: Headers | Record<string, string>): Headers {
  const result = new Headers(headers);
  const vary = result.get("vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "accept-encoding")) {
    result.set("vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  }
  return result;
}

function isCompressible(contentType: string | null): boolean {
  return Boolean(!contentType || COMPRESSIBLE_CONTENT_TYPE_RE.test(contentType));
}

export function compressedResponse(
  body: string,
  headers: Headers | Record<string, string>,
  acceptEncoding: string | null,
  status = 200,
): Response {
  const responseHeaders = headersWithVary(headers);
  if (acceptsGzip(acceptEncoding)) {
    responseHeaders.set("content-encoding", "gzip");
    return new Response(gzipSync(body), { headers: responseHeaders, status });
  }
  return new Response(body, { headers: responseHeaders, status });
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
  if (!acceptsGzip(acceptEncoding)) {
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  headers.set("content-encoding", "gzip");
  return new Response(gzipSync(await response.arrayBuffer()), {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
