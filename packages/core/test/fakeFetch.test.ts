import { describe, expect, test } from "bun:test";
import { createFakeEnv } from "../src/testing";

describe("fake fetch", () => {
  test("records calls with url, method and init", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond(/./, new Response("ok"));
    await fetch("https://a.test/x");
    await fetch(new URL("https://a.test/y"), { body: "b", method: "post" });
    expect(fetch.calls.map(({ url, method }) => [url, method])).toEqual([
      ["https://a.test/x", "GET"],
      ["https://a.test/y", "POST"],
    ]);
    expect(fetch.calls[1]?.init?.body).toBe("b");
  });

  test("answers a url with a response that can be read every time", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond("https://a.test/x", Response.json({ n: 1 }));
    expect(await (await fetch("https://a.test/x")).json()).toEqual({ n: 1 });
    expect(await (await fetch("https://a.test/x")).json()).toEqual({ n: 1 });
  });

  test("matches by regex and predicate", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond(/\/users\/\d+$/, new Response("user"));
    fetch.respond((url) => url.endsWith("/ping"), new Response("pong"));
    expect(await (await fetch("https://a.test/users/4")).text()).toBe("user");
    expect(await (await fetch("https://a.test/ping")).text()).toBe("pong");
  });

  test("lets a later route win", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond(/./, new Response("first"));
    fetch.respond(/./, new Response("second"));
    expect(await (await fetch("https://a.test/")).text()).toBe("second");
  });

  test("computes a response from the call", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond(/./, (call) => new Response(call.method));
    expect(await (await fetch("https://a.test/", { method: "PUT" })).text()).toBe("PUT");
  });

  test("rejects when the handler throws", async () => {
    const { fetch } = createFakeEnv();
    fetch.respond(/./, () => {
      throw new Error("offline");
    });
    await expect(fetch("https://a.test/")).rejects.toThrow("offline");
  });

  test("rejects on a url nobody programmed", async () => {
    const { fetch } = createFakeEnv();
    await expect(fetch("https://a.test/none")).rejects.toThrow(
      "unmatched fetch GET https://a.test/none",
    );
    expect(fetch.calls).toHaveLength(1);
  });

  test("holds a call until it is resolved by hand", async () => {
    const { fetch } = createFakeEnv();
    fetch.hold("https://a.test/slow");
    let result: Response | undefined;
    const request = fetch("https://a.test/slow").then((response) => {
      result = response;
    });
    await Promise.resolve();
    expect(result).toBeUndefined();
    const [call] = fetch.pending();
    expect(call?.settled).toBe(false);
    call?.resolve(new Response("done"));
    await request;
    expect(await result?.text()).toBe("done");
    expect(call?.settled).toBe(true);
    expect(fetch.pending()).toEqual([]);
  });

  test("holds a call until it is rejected by hand", async () => {
    const { fetch } = createFakeEnv();
    fetch.hold(/./);
    const request = fetch("https://a.test/");
    fetch.pending()[0]?.reject(new Error("dropped"));
    await expect(request).rejects.toThrow("dropped");
  });

  test("settles a call only once", async () => {
    const { fetch } = createFakeEnv();
    fetch.hold(/./);
    const request = fetch("https://a.test/");
    const [call] = fetch.pending();
    call?.resolve(new Response("first"));
    call?.reject(new Error("late"));
    call?.resolve(new Response("second"));
    expect(await (await request).text()).toBe("first");
  });

  test("answers out of order when held calls are settled out of order", async () => {
    const { fetch } = createFakeEnv();
    fetch.hold(/./);
    const order: string[] = [];
    const first = fetch("https://a.test/1").then(() => order.push("1"));
    const second = fetch("https://a.test/2").then(() => order.push("2"));
    const [one, two] = fetch.pending();
    two?.resolve(new Response());
    one?.resolve(new Response());
    await Promise.all([first, second]);
    expect(order).toEqual(["2", "1"]);
  });

  test("delays an answer on the fake clock", async () => {
    const env = createFakeEnv();
    env.fetch.respond(
      /./,
      () => new Promise((resolve) => env.setTimeout(() => resolve(new Response("late")), 500)),
    );
    let done = false;
    const request = env.fetch("https://a.test/").then(() => {
      done = true;
    });
    env.advance(499);
    await Promise.resolve();
    expect(done).toBe(false);
    env.advance(1);
    await request;
    expect(done).toBe(true);
  });

  test("rejects a held call when its signal aborts", async () => {
    const { fetch } = createFakeEnv();
    fetch.hold(/./);
    const controller = new AbortController();
    const request = fetch("https://a.test/", { signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(request).rejects.toThrow("cancelled");
  });
});
