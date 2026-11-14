import { describe, expect, test } from "bun:test";
import { type HttpContext, type HttpHandler, runHttp } from "../src/http";

function context(path = "/"): HttpContext {
  const url = new URL(path, "https://slock.test");
  return { req: new Request(url), upgrade: () => false, url };
}

const reply =
  (body: string): HttpHandler =>
  () =>
    new Response(body);

async function bodyOf(response: Promise<Response | undefined>) {
  return (await response)?.text();
}

describe("runHttp", () => {
  test("answers nothing without handlers", async () => {
    expect(await runHttp([], context())).toBeUndefined();
  });

  test("the handler added last runs first", async () => {
    const calls: string[] = [];
    const record =
      (name: string): HttpHandler =>
      (_c, next) => {
        calls.push(name);
        return next();
      };
    await runHttp([record("first"), record("second"), record("third")], context());
    expect(calls).toEqual(["third", "second", "first"]);
  });

  test("a handler that does not call next ends the chain", async () => {
    const calls: string[] = [];
    const inner: HttpHandler = () => {
      calls.push("inner");
      return new Response("inner");
    };
    const outer: HttpHandler = () => {
      calls.push("outer");
      return new Response("outer");
    };
    expect(await bodyOf(runHttp([inner, outer], context()))).toBe("outer");
    expect(calls).toEqual(["outer"]);
  });

  test("a handler returning undefined without next answers nothing", async () => {
    const swallow: HttpHandler = () => undefined;
    expect(await runHttp([reply("inner"), swallow], context())).toBeUndefined();
  });

  test("falls through to the next handler that answers", async () => {
    const passes: HttpHandler = (_c, next) => next();
    expect(await bodyOf(runHttp([reply("deep"), passes, passes], context()))).toBe("deep");
  });

  test("a wrapper can change the response of what it wraps", async () => {
    const shout: HttpHandler = async (_c, next) => {
      const response = await next();
      return response && new Response((await response.text()).toUpperCase());
    };
    expect(await bodyOf(runHttp([reply("quiet"), shout], context()))).toBe("QUIET");
  });

  test("a wrapper sees nothing when no handler below answers", async () => {
    let seen: Response | undefined | "unset" = "unset";
    const watch: HttpHandler = async (_c, next) => {
      seen = await next();
      return seen;
    };
    await runHttp([watch], context());
    expect(seen).toBeUndefined();
  });

  test("every handler gets the same context", async () => {
    const contexts: HttpContext[] = [];
    const record: HttpHandler = (c, next) => {
      contexts.push(c);
      return next();
    };
    const c = context("/a?b=1");
    await runHttp([record, record, record], c);
    expect(contexts).toEqual([c, c, c]);
  });

  test("a handler can route on the url", async () => {
    const route =
      (path: string, body: string): HttpHandler =>
      (c, next) =>
        c.url.pathname === path ? new Response(body) : next();
    const handlers = [route("/a", "A"), route("/b", "B")];
    expect(await bodyOf(runHttp(handlers, context("/a")))).toBe("A");
    expect(await bodyOf(runHttp(handlers, context("/b")))).toBe("B");
    expect(await runHttp(handlers, context("/c"))).toBeUndefined();
  });

  test("a throwing handler rejects the whole request", async () => {
    const boom: HttpHandler = () => {
      throw new Error("boom");
    };
    await expect(runHttp([reply("never"), boom], context())).rejects.toThrow("boom");
  });

  test("calling next twice reruns the rest of the chain", async () => {
    let hits = 0;
    const count: HttpHandler = () => {
      hits++;
      return new Response("x");
    };
    const twice: HttpHandler = async (_c, next) => {
      await next();
      return next();
    };
    await runHttp([count, twice], context());
    expect(hits).toBe(2);
  });
});
