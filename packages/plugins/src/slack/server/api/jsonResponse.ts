import { jsonHeaders } from "./auth.ts";

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const normalized =
    data && typeof data === "object" && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== "ok"))
      : data;
  return new Response(JSON.stringify(normalized), {
    headers: { ...jsonHeaders, ...extraHeaders },
    status,
  });
}

export function okResponse(): Response {
  return jsonResponse({});
}

export function errorResponse(error: string, status: number, details?: unknown): Response {
  return new Response(JSON.stringify({ error, ...(details === undefined ? {} : { details }) }), {
    headers: jsonHeaders,
    status,
  });
}

export function slackErrorResponse(
  data: { error?: string; retry_after?: string },
  fallback: string,
): Response {
  const error =
    typeof data.error === "string" && data.error
      ? data.error
      : `${fallback} failed without an error: ${JSON.stringify(data)}`;
  const rateLimited = error === "ratelimited" || error === "rate_limited" || !!data.retry_after;
  const body = data.retry_after ? { error, retry_after: data.retry_after } : { error };
  return jsonResponse(
    body,
    rateLimited ? 429 : 502,
    data.retry_after ? { "retry-after": data.retry_after } : undefined,
  );
}
