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
  const body = JSON.stringify(rewriteSlackAssetUrls(data, creds));
  if (status && status !== 200) return new Response(body, { headers: jsonHeaders, status });
  return compressedResponse(body, jsonHeaders, acceptEncoding);
}

export function okResponse(creds: Credentials | null, acceptEncoding: string | null): Response {
  return jsonResponse({ ok: true }, creds, acceptEncoding);
}

export function errorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error, ok: false }), { headers: jsonHeaders, status });
}

// A failed Slack call is still HTTP 200 (matches Slack's own ok:false convention).
export function slackErrorResponse(
  data: { error?: string },
  fallback: string,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Response {
  return jsonResponse({ error: data.error ?? fallback, ok: false }, creds, acceptEncoding);
}
