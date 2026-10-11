export interface HttpContext {
  req: Request;
  url: URL;
}

export type HttpHandler = (
  c: HttpContext,
  next: () => Promise<Response | undefined>,
) => Response | undefined | Promise<Response | undefined>;

declare module "./types" {
  interface Points {
    http: HttpHandler;
  }
}

export function runHttp(
  handlers: readonly HttpHandler[],
  c: HttpContext,
): Promise<Response | undefined> {
  const outerFirst = handlers.toReversed();
  function call(index: number): Promise<Response | undefined> {
    const handler = outerFirst[index];
    return Promise.resolve(handler?.(c, () => call(index + 1)));
  }
  return call(0);
}
