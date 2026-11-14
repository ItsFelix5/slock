import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createEffect, createRoot, onCleanup } from "solid-js";
import { createHost } from "../src/host";
import { solidReactive } from "../src/solidHost";
import { forAll, int } from "../src/testing";
import type { PluginDef, Setup } from "../src/types";

declare module "../src/types" {
  interface Services {
    hostTestGreeting: { text: string };
  }
  interface Points {
    hostTestItems: string;
  }
}

type Host = ReturnType<typeof createHost>;

function tracked(
  events: string[],
  id: string,
  requires: string[] = [],
  label = id,
  extra: Setup = () => {},
): PluginDef {
  return {
    id,
    requires,
    setup: (ctx) => {
      events.push(`start:${label}`);
      ctx.onCleanup(() => events.push(`stop:${label}`));
      return extra(ctx);
    },
  };
}

function states(host: Host) {
  return Object.fromEntries(host.list().map(({ id, status }) => [id, status.state]));
}

beforeEach(() => {
  spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mock.restore();
});

describe("stop and restart leave nothing behind", () => {
  function fixture() {
    const events: string[] = [];
    const listeners = new Set<number>();
    let nextListener = 0;
    const listen = (ctx: Parameters<Setup>[0]) => {
      const id = nextListener++;
      listeners.add(id);
      ctx.onCleanup(() => listeners.delete(id));
    };
    const defs = [
      tracked(events, "base", [], "base", (ctx) => {
        listen(ctx);
        ctx.provide("hostTestGreeting", { text: "hi" });
        ctx.add("hostTestItems", "from base");
      }),
      tracked(events, "top", ["base"], "top", (ctx) => {
        listen(ctx);
        ctx.add("hostTestItems", "from top");
      }),
    ];
    return { defs, events, listeners };
  }

  test("stop runs cleanups dependents first and removes services and points", async () => {
    const { defs, events, listeners } = fixture();
    const host = createHost();
    await host.register(...defs);
    expect(listeners.size).toBe(2);
    await host.stop();
    expect(events).toEqual(["start:base", "start:top", "stop:top", "stop:base"]);
    expect(listeners.size).toBe(0);
    expect(host.service("hostTestGreeting")).toBeUndefined();
    expect(host.items("hostTestItems")).toEqual([]);
    expect(states(host)).toEqual({ base: "off", top: "off" });
  });

  test("restart stops everything, calls beforeRestart, then starts again", async () => {
    const { defs, events, listeners } = fixture();
    const host = createHost({ beforeRestart: () => events.push("beforeRestart") });
    await host.register(...defs);
    events.length = 0;
    await host.restart();
    expect(events).toEqual(["stop:top", "stop:base", "beforeRestart", "start:base", "start:top"]);
    expect(listeners.size).toBe(2);
    expect(host.items("hostTestItems")).toEqual(["from base", "from top"]);
  });

  test("restart cycles never accumulate listeners, items or services", async () => {
    const { defs, listeners } = fixture();
    const host = createHost();
    await host.register(...defs);
    for (let i = 0; i < 5; i++) await host.restart();
    expect(listeners.size).toBe(2);
    expect(host.items("hostTestItems")).toHaveLength(2);
  });

  test("a throwing cleanup does not stop the others from running", async () => {
    const events: string[] = [];
    const host = createHost();
    await host.register({
      id: "messy",
      setup: (ctx) => {
        ctx.onCleanup(() => events.push("first registered"));
        ctx.onCleanup(() => {
          throw new Error("cleanup broke");
        });
        ctx.onCleanup(() => events.push("last registered"));
      },
    });
    await host.stop();
    expect(events).toEqual(["last registered", "first registered"]);
  });

  test("effects created in setup are disposed on stop", async () => {
    const events: string[] = [];
    const host = createHost({ reactive: solidReactive });
    await host.register({
      id: "effects",
      setup: () => {
        createEffect(() => onCleanup(() => events.push("effect disposed")));
      },
    });
    expect(events).toEqual([]);
    await host.stop();
    expect(events).toEqual(["effect disposed"]);
  });
});

describe("changing the plugin set", () => {
  test("registering an id again restarts it and its dependents in a safe order", async () => {
    const events: string[] = [];
    const host = createHost();
    await host.register(tracked(events, "a", [], "a1"), tracked(events, "b", ["a"]));
    events.length = 0;
    await host.register(tracked(events, "a", [], "a2"));
    expect(events).toEqual(["stop:b", "stop:a1", "start:a2", "start:b"]);
  });

  test("unregister stops dependents before the plugin and blocks them", async () => {
    const events: string[] = [];
    const host = createHost();
    await host.register(tracked(events, "a"), tracked(events, "b", ["a"]));
    events.length = 0;
    await host.unregister("a");
    expect(events).toEqual(["stop:b", "stop:a"]);
    expect(states(host)).toEqual({ b: "blocked" });
    expect(host.list()[0]?.status.error).toBe("needs a, which is not installed");
  });

  test("queued calls run in order and end in a consistent state", async () => {
    const events: string[] = [];
    const host = createHost();
    await Promise.all([
      host.register(tracked(events, "a")),
      host.setEnabled("a", false),
      host.setEnabled("a", true),
      host.restart(),
      host.unregister("a"),
      host.register(tracked(events, "a")),
    ]);
    const starts = events.filter((event) => event.startsWith("start:")).length;
    const stops = events.filter((event) => event.startsWith("stop:")).length;
    expect(starts - stops).toBe(1);
    expect(states(host)).toEqual({ a: "running" });
  });
});

describe("reactivity with the solid adapter", () => {
  test("items and list update when plugins start and stop", async () => {
    const host = createHost({ reactive: solidReactive });
    const items: string[] = [];
    const listings: string[] = [];
    const dispose = createRoot((disposeRoot) => {
      createEffect(() => items.push(host.items("hostTestItems").join(",")));
      createEffect(() => listings.push(JSON.stringify(states(host))));
      return disposeRoot;
    });
    await host.register({ id: "p", setup: (ctx) => ctx.add("hostTestItems", "x") });
    await host.stop();
    dispose();
    expect(items).toEqual(["", "x", ""]);
    expect(listings.at(0)).toBe("{}");
    expect(listings.some((snapshot) => snapshot === '{"p":"running"}')).toBe(true);
    expect(listings.at(-1)).toBe('{"p":"off"}');
  });
});

describe("random dependency graphs", () => {
  type Graph = { requires: number[][]; registerOrder: number[] };

  function generateGraph(random: () => number): Graph {
    const size = int(random, 1, 8);
    const requires = Array.from({ length: size }, (_, index) =>
      index === 0 ? [] : Array.from({ length: int(random, 0, 2) }, () => int(random, 0, index - 1)),
    );
    const registerOrder = Array.from({ length: size }, (_, index) => index);
    for (let i = size - 1; i > 0; i--) {
      const j = int(random, 0, i);
      [registerOrder[i], registerOrder[j]] = [registerOrder[j] ?? 0, registerOrder[i] ?? 0];
    }
    return { registerOrder, requires };
  }

  test("every plugin starts after its requirements and stops before them", async () => {
    const graphs: Graph[] = [];
    forAll(generateGraph, (graph) => graphs.push(graph), 40);
    for (const { registerOrder, requires } of graphs) {
      const events: string[] = [];
      const host = createHost();
      const defs = registerOrder.map((index) =>
        tracked(
          events,
          `p${index}`,
          requires[index]?.map((dep) => `p${dep}`),
        ),
      );
      await host.register(...defs);
      await host.restart();
      for (const phase of ["start", "stop"] as const) {
        const seen = events.filter((event) => event.startsWith(`${phase}:`));
        for (const [index, deps] of requires.entries()) {
          for (const dep of deps) {
            const before = phase === "start" ? `p${dep}` : `p${index}`;
            const after = phase === "start" ? `p${index}` : `p${dep}`;
            expect(seen.indexOf(`${phase}:${before}`)).toBeLessThan(
              seen.indexOf(`${phase}:${after}`),
            );
          }
        }
      }
      await host.stop();
      const open = new Set<string>();
      for (const event of events) {
        const [phase, id] = event.split(":");
        if (phase === "start" && id) open.add(id);
        else if (id) open.delete(id);
      }
      expect(open.size).toBe(0);
    }
  });
});
