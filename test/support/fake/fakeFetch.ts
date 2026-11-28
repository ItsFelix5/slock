import type { Env } from "../../../packages/core/src/types";

type FetchMatch = string | RegExp | ((url: string) => boolean);
type FetchHandler = Response | ((call: FetchCall) => Response | Promise<Response>);

type FetchCall = {
  readonly url: string;
  readonly method: string;
  readonly init: RequestInit | undefined;
  readonly settled: boolean;
  resolve(response: Response): void;
  reject(error: unknown): void;
};

export type FakeFetch = Env["fetch"] & {
  calls: FetchCall[];
  respond(match: FetchMatch, handler: FetchHandler): void;
  hold(match: FetchMatch): void;
  pending(): FetchCall[];
};

type Route = { match: FetchMatch; handler: FetchHandler | undefined };

function matches(match: FetchMatch, url: string): boolean {
  if (typeof match === "string") return match === url;
  if (match instanceof RegExp) return match.test(url);
  return match(url);
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function methodOf(input: RequestInfo | URL, init: RequestInit | undefined): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

export function createFakeFetch(): FakeFetch {
  const routes: Route[] = [];
  const calls: FetchCall[] = [];
  const held = new Set<FetchCall>();

  function createCall(input: RequestInfo | URL, init: RequestInit | undefined) {
    let settled = false;
    let resolve: (response: Response) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<Response>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      held.delete(call);
      finish();
    };
    const call: FetchCall = {
      init,
      method: methodOf(input, init),
      reject: (error) => settle(() => reject(error)),
      resolve: (response) => settle(() => resolve(response)),
      get settled() {
        return settled;
      },
      url: urlOf(input),
    };
    init?.signal?.addEventListener("abort", () => call.reject(init.signal?.reason), { once: true });
    if (init?.signal?.aborted) call.reject(init.signal.reason);
    return { call, promise };
  }

  function run(call: FetchCall) {
    const route = routes.findLast((candidate) => matches(candidate.match, call.url));
    if (!route) return call.reject(new Error(`unmatched fetch ${call.method} ${call.url}`));
    if (!route.handler) {
      held.add(call);
      return;
    }
    try {
      const { handler } = route;
      const result = typeof handler === "function" ? handler(call) : handler.clone();
      Promise.resolve(result).then(call.resolve, call.reject);
    } catch (error) {
      call.reject(error);
    }
  }

  const fetch: Env["fetch"] = (input, init) => {
    const { call, promise } = createCall(input, init);
    calls.push(call);
    if (!call.settled) run(call);
    return promise;
  };

  return Object.assign(fetch, {
    calls,
    hold: (match: FetchMatch) => void routes.push({ handler: undefined, match }),
    pending: () => [...held],
    respond: (match: FetchMatch, handler: FetchHandler) => void routes.push({ handler, match }),
  });
}
