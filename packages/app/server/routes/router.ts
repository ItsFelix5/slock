import type { Credentials } from "../auth.ts";

export type BodyReader = {
  json(): Promise<Record<string, unknown>>;
  text(): Promise<string>;
  buffer(): Promise<Uint8Array>;
};

export type RouteCtx = {
  params: Record<string, string>;
  searchParams: URLSearchParams;
  creds: Credentials | null;
  secure: boolean;
  acceptEncoding: string | null;
  body: BodyReader;
};

export type Route = {
  method: string;
  segments: string[];
  handler: (ctx: RouteCtx) => Promise<Response>;
};

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

// `path` uses `:name` segments for params, e.g. "/api/channels/:id/messages".
export function route(method: string, path: string, handler: Route["handler"]): Route {
  return { handler, method, segments: splitPath(path) };
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
  const parts = splitPath(pathname);
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const params = matchSegments(candidate.segments, parts);
    if (params) return { params, route: candidate };
  }
  return null;
}
