import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  followJsRedirects,
  postForm,
  visit,
} from "../../../src/hackclub-login/server/hackclubHttp";

type Seen = { url: string; method: string; cookie: string | null; body: string; headers: Headers };

function fakeFetch(respond: (seen: Seen, count: number) => Response) {
  const seen: Seen[] = [];
  spyOn(globalThis, "fetch").mockImplementation(((input: URL | RequestInfo, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const entry = {
      body: String(init?.body ?? ""),
      cookie: headers.get("cookie"),
      headers,
      method: init?.method ?? "GET",
      url: String(input),
    };
    seen.push(entry);
    return Promise.resolve(respond(entry, seen.length));
  }) as typeof fetch);
  return seen;
}

function page(body: string, cookies: string[] = [], status = 200, location?: string) {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  if (location) headers.set("location", location);
  return new Response(body, { headers, status });
}

afterEach(() => mock.restore());

describe("cookie jar", () => {
  test("stores Set-Cookie pairs and sends them on the next request", async () => {
    const seen = fakeFetch((_, count) =>
      page("ok", count === 1 ? ["a=1; Path=/; HttpOnly", "b=x=y"] : []),
    );
    const jar = new Map<string, string>();
    await visit(jar, "https://auth.hackclub.com/login");
    await visit(jar, "https://auth.hackclub.com/next");
    expect(seen[0]?.cookie).toBeNull();
    expect(seen[1]?.cookie).toBe("a=1; b=x=y");
  });

  test("a later cookie with the same name replaces the earlier one", async () => {
    const seen = fakeFetch((_, count) => page("ok", [`a=${count}`]));
    const jar = new Map<string, string>();
    await visit(jar, "https://auth.hackclub.com/1");
    await visit(jar, "https://auth.hackclub.com/2");
    await visit(jar, "https://auth.hackclub.com/3");
    expect(seen[2]?.cookie).toBe("a=2");
  });

  test("expired and cleared cookies are removed", async () => {
    const seen = fakeFetch((_, count) =>
      page(
        "ok",
        count === 1
          ? ["a=1", "b=2", "c=3"]
          : ["a=; Max-Age=0", "b=gone; Expires=Thu, 01 Jan 1970 00:00:00 GMT", "c="],
      ),
    );
    const jar = new Map<string, string>();
    await visit(jar, "https://auth.hackclub.com/1");
    await visit(jar, "https://auth.hackclub.com/2");
    await visit(jar, "https://auth.hackclub.com/3");
    expect(seen[2]?.cookie).toBeNull();
    expect(jar.size).toBe(0);
  });

  test("ignores malformed Set-Cookie values", async () => {
    fakeFetch(() => page("ok", ["novalue", "=x", "good=1"]));
    const jar = new Map<string, string>();
    await visit(jar, "https://auth.hackclub.com/");
    expect([...jar]).toEqual([["good", "1"]]);
  });
});

describe("redirects", () => {
  test("follows redirects and keeps cookies set on the way", async () => {
    const seen = fakeFetch((entry) =>
      entry.url.endsWith("/start")
        ? page("", ["s=1"], 302, "/middle")
        : entry.url.endsWith("/middle")
          ? page("", [], 303, "https://auth.hackclub.com/end")
          : page("done"),
    );
    const result = await visit(new Map(), "https://auth.hackclub.com/start");
    expect(result).toEqual({ body: "done", url: "https://auth.hackclub.com/end" });
    expect(seen.map((s) => s.cookie)).toEqual([null, "s=1", "s=1"]);
  });

  test("gives up on redirect loops with a short error", async () => {
    fakeFetch(() => page("", [], 302, "/loop"));
    await expect(visit(new Map(), "https://auth.hackclub.com/loop")).rejects.toThrow("looped");
  });

  test("follows script redirects up to a limit", async () => {
    const seen = fakeFetch((entry) =>
      entry.url.endsWith("/a") ? page(`<script>window.location = "/b"</script>`) : page("final"),
    );
    const result = await followJsRedirects(new Map(), {
      body: `<script>window.location.href='/a'</script>`,
      url: "https://auth.hackclub.com/",
    });
    expect(result.body).toBe("final");
    expect(seen.map((s) => s.url)).toEqual([
      "https://auth.hackclub.com/a",
      "https://auth.hackclub.com/b",
    ]);
  });
});

describe("postForm", () => {
  test("posts urlencoded fields with origin and referer", async () => {
    const seen = fakeFetch(() => page("ok"));
    await postForm(
      new Map(),
      "https://auth.hackclub.com/login",
      { code: "123 456", email: "a+b@x.dev" },
      "https://auth.hackclub.com/login/xyz",
    );
    const headers = seen[0]?.headers;
    expect(headers?.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(headers?.get("origin")).toBe("https://auth.hackclub.com");
    expect(headers?.get("referer")).toBe("https://auth.hackclub.com/login/xyz");
  });

  test("encodes the body", async () => {
    const seen = fakeFetch(() => page("ok"));
    await postForm(
      new Map(),
      "https://auth.hackclub.com/",
      { e: "a+b&c" },
      "https://auth.hackclub.com/",
    );
    expect(seen[0]?.body).toBe("e=a%2Bb%26c");
    expect(seen[0]?.method).toBe("POST");
  });
});
