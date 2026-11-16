import type { HttpHandler } from "@slock/core";
import type { Credentials } from "./auth.ts";
import { okResponse, slackErrorResponse } from "./jsonResponse.ts";
import { callSlack } from "./slackClient.ts";

export type BodyReader = {
  json<T>(): Promise<T>;
  buffer(): Promise<Uint8Array>;
};

type ParamNames<Path extends string> = Path extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<Rest>
  : Path extends `${string}:${infer Name}`
    ? Name
    : never;

export type RouteCtx<Path extends string = string> = {
  params: Record<ParamNames<Path>, string>;
  searchParams: URLSearchParams;
  creds: Credentials | null;
  cookie: string | null;
  acceptEncoding: string | null;
  body: BodyReader;
  range: string | null;
};

export type Route = {
  method: string;
  segments: string[];
  handler(ctx: RouteCtx): Response | Promise<Response>;
};

export function route<Path extends string>(
  method: string,
  path: Path,
  handler: (ctx: RouteCtx<Path>) => Response | Promise<Response>,
): Route {
  return { handler, method, segments: path.split("/").filter(Boolean) };
}

export async function mutate(
  slackMethod: string,
  params: Record<string, string | string[]>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await callSlack(slackMethod, params, ctx.creds);
  if (!data.ok) return slackErrorResponse(data, slackMethod, ctx.creds);
  return okResponse(ctx.creds);
}

function matchSegments(segments: string[], parts: string[]): Record<string, string> | null {
  if (segments.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (const [i, segment] of segments.entries()) {
    if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(parts[i] ?? "");
    else if (segment !== parts[i]) return null;
  }
  return params;
}

function matchRoute(list: Route[], method: string, pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  for (const candidate of list) {
    if (candidate.method !== method) continue;
    const params = matchSegments(candidate.segments, parts);
    if (params) return { params, route: candidate };
  }
  return null;
}

export function routes(list: Route[]): HttpHandler {
  return (c, next) => {
    if (!c.url.pathname.startsWith("/api/")) return next();
    const matched = matchRoute(list, c.req.method, c.url.pathname.slice("/api".length));
    if (!matched) return next();
    return matched.route.handler({
      acceptEncoding: c.req.headers.get("accept-encoding"),
      body: {
        buffer: async () => new Uint8Array(await c.req.arrayBuffer()),
        json: async () => JSON.parse(await c.req.text()),
      },
      cookie: c.req.headers.get("cookie"),
      creds: c.creds ?? null,
      params: matched.params,
      range: c.req.headers.get("range"),
      searchParams: c.url.searchParams,
    });
  };
}

export function prefWrite(name: string, value: string, ctx: RouteCtx) {
  return mutate("users.prefs.set", { name, value }, ctx);
}
