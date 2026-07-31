import { gzipSync } from "node:zlib";

// Shared by every text/JSON response this relay sends — gzips when the
// client says it accepts it instead of shipping large raw payloads.
export function compressedResponse(
  body: string,
  headers: Record<string, string>,
  acceptEncoding: string | null,
): Response {
  const withVary = {
    ...headers,
    vary: headers.vary ? `${headers.vary}, Accept-Encoding` : "Accept-Encoding",
  };
  if (acceptEncoding?.split(",").some((part) => part.trim().startsWith("gzip"))) {
    return new Response(gzipSync(body), { headers: { ...withVary, "content-encoding": "gzip" } });
  }
  return new Response(body, { headers: withVary });
}
