import type { HttpHandler } from "@slock/core/http";
import { isChannelId, isFileId, isTs, isUserId } from "@slock/slack";
import type { ChannelId, FileId, Ts, UserId } from "@slock/types";
import type { Credentials } from "./auth.ts";
import { errorResponse, okResponse, slackErrorResponse } from "./jsonResponse.ts";
import { callSlack } from "./slackClient.ts";

type BodyReader = {
  json<T>(): Promise<T>;
  buffer(): Promise<Uint8Array>;
};

type ParamIds = {
  canvases: FileId;
  channel: ChannelId;
  channels: ChannelId;
  conversations: ChannelId;
  files: FileId;
  ts: Ts;
  users: UserId;
};

const PARAM_GUARDS: { [K in keyof ParamIds]: (raw: string) => raw is ParamIds[K] } = {
  canvases: isFileId,
  channel: isChannelId,
  channels: isChannelId,
  conversations: isChannelId,
  files: isFileId,
  ts: isTs,
  users: isUserId,
};

type GuardedId<Key extends string> = Key extends keyof ParamIds ? ParamIds[Key] : never;

type ParamType<Name extends string, Prev extends string> = [GuardedId<Name>] extends [never]
  ? [GuardedId<Prev>] extends [never]
    ? string
    : GuardedId<Prev>
  : GuardedId<Name>;

type SegmentParams<Segment extends string, Prev extends string> = Segment extends `:${infer Name}`
  ? { [K in Name]: ParamType<Name, Prev> }
  : unknown;

type PathParams<
  Path extends string,
  Prev extends string = "",
> = Path extends `${infer Head}/${infer Rest}`
  ? SegmentParams<Head, Prev> & PathParams<Rest, Head>
  : SegmentParams<Path, Prev>;

export type RouteCtx<Path extends string = string> = {
  params: PathParams<Path>;
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
  if (!data.ok) return slackErrorResponse(data, slackMethod);
  return okResponse();
}

type Match = { params: Record<string, string> } | { invalid: string };

function guardFor(name: string, prev: string): ((raw: string) => boolean) | undefined {
  const entries = Object.entries(PARAM_GUARDS);
  return (entries.find(([key]) => key === name) ?? entries.find(([key]) => key === prev))?.[1];
}

function matchSegments(segments: string[], parts: string[]): Match | null {
  if (segments.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (const [i, segment] of segments.entries()) {
    if (!segment.startsWith(":")) {
      if (segment !== parts[i]) return null;
      continue;
    }
    const name = segment.slice(1);
    const value = decodeURIComponent(parts[i] ?? "");
    if (guardFor(name, segments[i - 1] ?? "")?.(value) === false) return { invalid: name };
    params[name] = value;
  }
  return { params };
}

function matchRoute(list: Route[], method: string, pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  let invalid: string | undefined;
  for (const candidate of list) {
    if (candidate.method !== method) continue;
    const match = matchSegments(candidate.segments, parts);
    if (match && "params" in match) return { params: match.params, route: candidate };
    if (match) invalid ??= match.invalid;
  }
  return invalid === undefined ? null : { invalid };
}

export function routes(list: Route[]): HttpHandler {
  return (c, next) => {
    if (!c.url.pathname.startsWith("/api/")) return next();
    const matched = matchRoute(list, c.req.method, c.url.pathname.slice("/api".length));
    if (!matched) return next();
    if ("invalid" in matched) return errorResponse(`invalid_${matched.invalid}`, 400);
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
