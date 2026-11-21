import { describe, expect, test } from "bun:test";
import { createEffect, createSignal } from "solid-js";
import { createHost } from "../src/host/host";
import { solidReactive } from "../src/solidHost";

declare module "../src/types" {
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
