import { describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import { createEffect, createRoot, flush } from "solid-js";
import { defineQuery } from "../../../src/query/client/api";
import querySetup from "../../../src/query/client/index";

async function start() {
  const env = createFakeEnv();
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register({ id: "query", setup: querySetup });
  return { env, host };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

describe("defineQuery", () => {
  test("ensure caches, invalidate refetches, patch undoes", async () => {
    await start();
    let calls = 0;
    const item = defineQuery<string, number>({
      load: (arg) => Promise.resolve(arg.length + ++calls),
      name: "item",
    });
    expect(await item.ensure("ab")).toBe(3);
    expect(await item.ensure("ab")).toBe(3);
    const undo = item.patch("ab", () => 99);
    expect(item.read("ab")).toBe(99);
    undo();
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
