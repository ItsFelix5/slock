import { expect, test } from "bun:test";
import { createFetch } from "../../packages/central/src/server";

const call = (fetch: ReturnType<typeof createFetch>, path: string, method = "GET") =>
  fetch(new Request(`http://central${path}`, { method }));

test("the first feature that answers wins and later ones never run", async () => {
  let reached = false;
  const fetch = createFetch([
    (_req, url) => (url.pathname === "/a" ? new Response("a") : undefined),
    () => {
      reached = true;
      return new Response("b");
    },
  ]);
  expect(await (await call(fetch, "/a")).text()).toBe("a");
  expect(reached).toBe(false);
  expect(await (await call(fetch, "/b")).text()).toBe("b");
});

test("unknown paths are a 404", async () => {
  const res = await call(createFetch([() => undefined]), "/nope");
  expect(res.status).toBe(404);
});

test("answers allow browsers from any origin, and preflights succeed", async () => {
  const fetch = createFetch([() => new Response("ok")]);
  expect((await call(fetch, "/x")).headers.get("access-control-allow-origin")).toBe("*");
  const preflight = await call(fetch, "/x", "OPTIONS");
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
});
