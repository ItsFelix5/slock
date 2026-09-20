import type { Credentials } from "../auth.ts";
import { okResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";

export type BodyReader = {
  json(): Promise<any>;
  buffer(): Promise<Uint8Array>;
};

export type RouteCtx = {
  params: Record<string, string>;
  searchParams: URLSearchParams;
  creds: Credentials | null;
  acceptEncoding: string | null;
  body: BodyReader;
  range: string | null;
};

export type Route = {
  method: string;
  segments: string[];
  handler: (ctx: RouteCtx) => Promise<Response>;
};

export function route(method: string, path: string, handler: Route["handler"]): Route {
  return { handler, method, segments: path.split("/").filter(Boolean) };
}

export async function mutate(
  slackMethod: string,
  params: Record<string, string>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await callSlack(slackMethod, params, ctx.creds);
  if (!data.ok) return slackErrorResponse(data, slackMethod, ctx.creds, ctx.acceptEncoding);
  return okResponse(ctx.creds, ctx.acceptEncoding);
}

function matchSegments(segments: string[], parts: string[]): Record<string, string> | null {
  if (segments.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(parts[i]);
    else if (segment !== parts[i]) return null;
  }
  return params;
}

export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const params = matchSegments(candidate.segments, parts);
    if (params) return { params, route: candidate };
  }
  return null;
}
