import { expect, test } from "bun:test";
import { createHost, Unavailable } from "./host";
import type { PluginDef } from "./types";

declare module "./types" {
  interface Points {
    "a.item": string;
  }
  interface Services {
    a: { value: number };
  }
}

function order(host: ReturnType<typeof createHost>) {
  return host.items("a.item");
}

const provider: PluginDef = {
  id: "a",
  setup: (ctx) => {
    ctx.provide("a", { value: 1 });
    ctx.add("a.item", "first", { id: "x", order: 1 });
  },
};

const consumer: PluginDef = {
  id: "b",
  requires: ["a"],
  setup: (ctx) => {
    ctx.add("a.item", `b${ctx.get("a").value}`, { order: 0 });
    ctx.add("a.item", "replaced", { id: "x", order: 2 });
  },
};

test("starts in requires order, sorts and replaces by id", async () => {
  const host = createHost({ plugins: [] });
  await host.register(consumer);
  await host.register(provider);
  expect(order(host)).toEqual(["b1", "replaced"]);
});

test("stopping a dependency stops dependents and removes contributions", async () => {
  const host = createHost();
  await host.register(provider);
  await host.register(consumer);
  await host.setEnabled("a", false);
  expect(order(host)).toEqual([]);
  expect(host.list().find((p) => p.id === "b")?.status.state).toBe("blocked");
  await host.setEnabled("a", true);
  expect(order(host)).toEqual(["b1", "replaced"]);
});

test("a failing plugin blocks dependents and nothing else", async () => {
  const host = createHost();
  await host.register({ id: "a", setup: () => Promise.reject(new Error("boom")) });
  await host.register(consumer);
  const states = Object.fromEntries(host.list().map((p) => [p.id, p.status.state]));
  expect(states).toEqual({ a: "failed", b: "blocked" });
});

test("restart rebuilds state", async () => {
  let starts = 0;
  const host = createHost();
  await host.register({ id: "a", setup: () => void starts++ });
  await host.restart();
  expect(starts).toBe(2);
});

test("cycles are rejected", async () => {
  const host = createHost();
  await host.register({ id: "a", requires: ["b"], setup: () => {} });
  await host.register({ id: "b", requires: ["a"], setup: () => {} });
  expect(host.list().every((p) => p.status.state === "blocked")).toBe(true);
});

test("an unavailable plugin is blocked quietly and blocks dependents", async () => {
  const host = createHost();
  await host.register(
    {
      id: "a",
      setup: () => {
        throw new Unavailable("needs an account");
      },
    },
    { id: "b", requires: ["a"], setup: () => {} },
  );
  const states = Object.fromEntries(host.list().map((p) => [p.id, p.status]));
  expect(states.a).toEqual({ error: "needs an account", state: "blocked" });
  expect(states.b?.state).toBe("blocked");
});
