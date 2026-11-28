import { describe, expect, test } from "bun:test";
import { createEffect, createSignal } from "solid-js";
import { solidReactive } from "../../packages/core/src/client/reactive";
import { createHost } from "../../packages/core/src/host/host";

declare module "../../packages/core/src/types" {
  interface Points {
    hostFlushItems: string;
  }
}

describe("a point write flushes outside the setup owner", () => {
  test("an effect created earlier in setup may write a signal in its apply", async () => {
    const [source] = createSignal("ready");
    const [target, setTarget] = createSignal("");
    const host = createHost({ reactive: solidReactive });
    await host.register({
      id: "late",
      requires: [],
      setup: (ctx) => {
        createEffect(source, (value) => {
          setTarget(value);
        });
        ctx.add("hostFlushItems", "item");
      },
    });
    expect(host.list().map(({ status }) => status.state)).toEqual(["running"]);
    expect(target()).toBe("ready");
  });
});
