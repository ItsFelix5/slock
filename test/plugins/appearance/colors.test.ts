import { expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { flush } from "solid-js";
import setup from "../../../packages/plugins/src/appearance/client/index";
import { createFakeEnv } from "../../support/core";

const colorVar = () => document.documentElement.style.getPropertyValue("--test-accent");

test("contributed colors apply without untracked reads", async () => {
  const warn = spyOn(console, "warn");
  const host = createHost({ env: createFakeEnv(1, 1_000_000), reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "appearance", setup },
    {
      id: "colors",
      setup: (ctx) => {
        ctx.add("appearance.colors", [
          { derive: "#123456", key: "testAccent", label: "Test accent" },
        ]);
      },
    },
  );
  flush();
  expect(colorVar()).toBe("#123456");
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
