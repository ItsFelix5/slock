import { rewriteSlackAssetUrls } from "../assets.ts";
import type { Credentials } from "../auth.ts";
import { jsonHeaders } from "../auth.ts";
import { compressedResponse } from "./compressedResponse.ts";

// Every purpose-built route returns through here: one place that rewrites
// Slack-hosted asset URLs into signed same-origin ones and gzips the result,
// so neither step can be forgotten as new routes are added.
export function jsonResponse(
  data: unknown,
  creds: Credentials | null,
  acceptEncoding: string | null,
  status?: number,
): Response {
  const normalized =
    data && typeof data === "object" && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== "ok"))
      : data;
  const body = JSON.stringify(rewriteSlackAssetUrls(normalized, creds));
  if (status && status !== 200) return new Response(body, { headers: jsonHeaders, status });
  return compressedResponse(body, jsonHeaders, acceptEncoding);
}

export function okResponse(creds: Credentials | null, acceptEncoding: string | null): Response {
  return jsonResponse({}, creds, acceptEncoding);
}

export function errorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { headers: jsonHeaders, status });
}

export function slackErrorResponse(
  data: { error?: string },
  fallback: string,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Response {
  return jsonResponse({ error: data.error ?? fallback }, creds, acceptEncoding, 502);
}
