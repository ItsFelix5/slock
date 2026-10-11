import { expect, test } from "bun:test";
import { createHost } from "./host";
import { runHttp } from "./http";

const context = {
  req: new Request("http://localhost/api/x"),
  url: new URL("http://localhost/api/x"),
};

test("a later plugin wraps an earlier route through next", async () => {
  const host = createHost();
  await host.register({
    id: "routes",
    setup: (ctx) => ctx.add("http", () => new Response("original")),
  });
  await host.register({
    id: "wrapper",
    setup: (ctx) =>
      ctx.add("http", async (_c, next) => new Response(`wrapped ${await (await next())?.text()}`)),
  });
  const response = await runHttp(host.items("http"), context);
  expect(await response?.text()).toBe("wrapped original");
});

test("higher order runs outer and can skip the chain", async () => {
  const host = createHost();
  await host.register({
    id: "inner",
    setup: (ctx) => ctx.add("http", () => new Response("inner"), { order: 0 }),
  });
  await host.register({
    id: "outer",
    setup: (ctx) => ctx.add("http", () => new Response("outer"), { order: 10 }),
  });
  const response = await runHttp(host.items("http"), context);
  expect(await response?.text()).toBe("outer");
});

test("an unanswered request falls through to nothing", async () => {
  const host = createHost();
  await host.register({ id: "idle", setup: (ctx) => ctx.add("http", (_c, next) => next()) });
  expect(await runHttp(host.items("http"), context)).toBeUndefined();
});

test("stopping a plugin removes its middleware", async () => {
  const host = createHost();
  await host.register({
    id: "temp",
    setup: (ctx) => ctx.add("http", () => new Response("temp")),
  });
  await host.setEnabled("temp", false);
  expect(await runHttp(host.items("http"), context)).toBeUndefined();
});
