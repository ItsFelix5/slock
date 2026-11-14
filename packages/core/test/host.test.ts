import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createHost, Unavailable } from "../src/host";
import type { PluginDef, Setup } from "../src/types";

declare module "../src/types" {
  interface Services {
    hostTestGreeting: { text: string };
    "hostTestOwner.value": { value: number };
  }
  interface Points {
    hostTestItems: string;
  }
}

function plugin(id: string, setup: Setup = () => {}, extra: Partial<PluginDef> = {}): PluginDef {
  return { id, setup, ...extra };
}

function states(host: ReturnType<typeof createHost>) {
  return Object.fromEntries(host.list().map(({ id, status }) => [id, status.state]));
}

let errors: ReturnType<typeof spyOn<Console, "error">>;

beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mock.restore();
});

describe("start order", () => {
  test("starts plugins after what they require, whatever the registration order", async () => {
    const started: string[] = [];
    const track = (id: string, requires: string[] = []) =>
      plugin(id, () => void started.push(id), { requires });
    const host = createHost();
    await host.register(track("c", ["b"]), track("b", ["a"]), track("a"));
    expect(started).toEqual(["a", "b", "c"]);
    expect(states(host)).toEqual({ a: "running", b: "running", c: "running" });
  });

  test("resolves requires through provides", async () => {
    const started: string[] = [];
    const host = createHost();
    await host.register(
      plugin("user", () => void started.push("user"), { requires: ["thing"] }),
      plugin("maker", () => void started.push("maker"), { provides: ["thing"] }),
    );
    expect(started).toEqual(["maker", "user"]);
  });

  test("waits for an async setup before starting dependents", async () => {
    const started: string[] = [];
    const host = createHost();
    await host.register(
      plugin("slow", async () => {
        await Bun.sleep(5);
        started.push("slow");
      }),
      plugin("after", () => void started.push("after"), { requires: ["slow"] }),
    );
    expect(started).toEqual(["slow", "after"]);
  });

  test("loads lazy plugins through load()", async () => {
    const host = createHost();
    await host.register({
      id: "lazy",
      load: async () => ({ default: (ctx) => ctx.provide("hostTestGreeting", { text: "hi" }) }),
    });
    expect(host.service("hostTestGreeting")).toEqual({ text: "hi" });
  });

  test("a plugin can read a service of something it requires", async () => {
    let seen: string | undefined;
    const host = createHost();
    await host.register(
      plugin(
        "reader",
        (ctx) => {
          seen = ctx.get("hostTestGreeting").text;
        },
        { requires: ["maker"] },
      ),
      plugin("maker", (ctx) => ctx.provide("hostTestGreeting", { text: "hello" })),
    );
    expect(seen).toBe("hello");
  });

  test("ctx.get warns about a service whose owner is not required", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const host = createHost();
    await host.register(
      plugin("hostTestOwner", (ctx) => ctx.provide("hostTestOwner.value", { value: 1 })),
      plugin("careless", (ctx) => void ctx.get("hostTestOwner.value")),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("does not require hostTestOwner");
  });

  test("ctx.get stays quiet when the owner is required", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const host = createHost();
    await host.register(
      plugin("hostTestOwner", (ctx) => ctx.provide("hostTestOwner.value", { value: 1 })),
      plugin("polite", (ctx) => void ctx.get("hostTestOwner.value"), {
        requires: ["hostTestOwner"],
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("what blocks a plugin", () => {
  test("a missing requirement blocks and the plugin starts once it appears", async () => {
    const host = createHost();
    await host.register(plugin("needy", () => {}, { requires: ["ghost"] }));
    expect(host.list()[0]?.status).toEqual({
      error: "needs ghost, which is not installed",
      state: "blocked",
    });
    await host.register(plugin("ghost"));
    expect(states(host)).toEqual({ ghost: "running", needy: "running" });
  });

  test("a dependency cycle blocks both sides without throwing", async () => {
    const host = createHost();
    await host.register(
      plugin("a", () => {}, { requires: ["b"] }),
      plugin("b", () => {}, { requires: ["a"] }),
      plugin("free"),
    );
    expect(states(host)).toEqual({ a: "blocked", b: "blocked", free: "running" });
    expect(host.list().map((info) => info.status.error)).toContain("dependency cycle");
  });

  test("defaultEnabled false stays off until enabled", async () => {
    const host = createHost();
    await host.register(plugin("opt", () => {}, { defaultEnabled: false }));
    expect(states(host)).toEqual({ opt: "off" });
    await host.setEnabled("opt", true);
    expect(states(host)).toEqual({ opt: "running" });
  });

  test("disabling a plugin stops it and blocks its dependents", async () => {
    const host = createHost();
    await host.register(
      plugin("base"),
      plugin("top", () => {}, { requires: ["base"] }),
    );
    await host.setEnabled("base", false);
    expect(states(host)).toEqual({ base: "off", top: "blocked" });
    expect(host.list().find((info) => info.id === "top")?.status.error).toBe("needs base");
    await host.setEnabled("base", true);
    expect(states(host)).toEqual({ base: "running", top: "running" });
  });

  test("a failing setup does not take down unrelated plugins", async () => {
    const host = createHost();
    await host.register(
      plugin("bad", () => {
        throw new Error("boom");
      }),
      plugin("child", () => {}, { requires: ["bad"] }),
      plugin("fine"),
    );
    expect(states(host)).toEqual({ bad: "failed", child: "blocked", fine: "running" });
    expect(host.list().find((info) => info.id === "bad")?.status.error).toBe("boom");
    expect(errors).toHaveBeenCalledTimes(1);
  });

  test("Unavailable blocks quietly and restart retries it", async () => {
    let ready = false;
    const host = createHost();
    await host.register(
      plugin("picky", () => {
        if (!ready) throw new Unavailable("needs an account");
      }),
    );
    expect(host.list()[0]?.status).toEqual({ error: "needs an account", state: "blocked" });
    expect(errors).not.toHaveBeenCalled();
    ready = true;
    await host.start();
    expect(states(host)).toEqual({ picky: "blocked" });
    await host.restart();
    expect(states(host)).toEqual({ picky: "running" });
  });

  test("a failed plugin is retried by setEnabled and by registering it again", async () => {
    let attempts = 0;
    const flaky = plugin("flaky", () => {
      if (++attempts < 3) throw new Error(`attempt ${attempts}`);
    });
    const host = createHost();
    await host.register(flaky);
    await host.start();
    expect(attempts).toBe(1);
    await host.setEnabled("flaky", true);
    expect(attempts).toBe(2);
    await host.register(flaky);
    expect(attempts).toBe(3);
    expect(states(host)).toEqual({ flaky: "running" });
  });
});

describe("failed setup leaves nothing behind", () => {
  function halfDone(ctx: Parameters<Setup>[0], cleaned: string[]) {
    ctx.provide("hostTestGreeting", { text: "half" });
    ctx.add("hostTestItems", "half");
    ctx.onCleanup(() => cleaned.push("cleanup"));
  }

  test("a synchronous throw removes services, points and runs cleanups", async () => {
    const cleaned: string[] = [];
    const host = createHost();
    await host.register(
      plugin("bad", (ctx) => {
        halfDone(ctx, cleaned);
        throw new Error("early");
      }),
    );
    expect(host.service("hostTestGreeting")).toBeUndefined();
    expect(host.items("hostTestItems")).toEqual([]);
    expect(cleaned).toEqual(["cleanup"]);
    expect(states(host)).toEqual({ bad: "failed" });
  });

  test("a rejection after an await does the same", async () => {
    const cleaned: string[] = [];
    const host = createHost();
    await host.register(
      plugin("bad", async (ctx) => {
        halfDone(ctx, cleaned);
        await Promise.resolve();
        throw new Error("late");
      }),
    );
    expect(host.service("hostTestGreeting")).toBeUndefined();
    expect(host.items("hostTestItems")).toEqual([]);
    expect(cleaned).toEqual(["cleanup"]);
  });

  test("ctx.get on a missing service fails the plugin with a readable message", async () => {
    const host = createHost();
    await host.register(plugin("reader", (ctx) => void ctx.get("hostTestGreeting")));
    expect(host.list()[0]?.status.error).toBe("reader: service hostTestGreeting is missing");
  });
});
