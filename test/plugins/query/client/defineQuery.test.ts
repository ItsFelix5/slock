import { describe, expect, test } from "bun:test";
import { createEffect, createRoot, flush } from "solid-js";
import { defineQuery } from "../../../../packages/plugins/src/query/client/api";
import { createFakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";

async function start() {
  const env = createFakeEnv();
  const host = await startQueryHost(env);
  return { env, host };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

describe("defineQuery", () => {
  test("ensure caches, refresh refetches, overlays discard", async () => {
    await start();
    let calls = 0;
    const item = defineQuery<string, number>({
      load: (arg) => Promise.resolve(arg.length + ++calls),
      name: "item",
    });
    expect(await item.ensure("ab")).toBe(3);
    expect(await item.ensure("ab")).toBe(3);
    const layer = item.overlay("ab", () => 99);
    expect(item.read("ab")).toBe(99);
    layer.discard();
    expect(item.read("ab")).toBe(3);
    expect(await item.refresh("ab")).toBe(4);
    item.modify("zz", () => 1);
    expect(item.read("zz")).toBeUndefined();
  });

  test("state hook subscribes, loads and reacts to set", async () => {
    await start();
    const item = defineQuery<string, string>({ load: (arg) => Promise.resolve(arg), name: "s" });
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      const state = item.state(() => "a");
      createEffect(
        () => state().data,
        (data) => void seen.push(data),
      );
      return stop;
    });
    await settle();
    item.set("a", "b");
    await settle();
    expect(seen.filter((value) => value !== undefined)).toEqual(["a", "b"]);
    dispose();
  });

  test("handles rebind to the new hub after a restart", async () => {
    const first = await start();
    const item = defineQuery<null, number>({ load: () => Promise.resolve(1), name: "r" });
    await item.ensure(null);
    await first.host.restart();
    expect(item.read(null)).toBeUndefined();
  });
});
