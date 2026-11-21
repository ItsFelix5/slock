import { expect, test } from "bun:test";
import { action, flush } from "solid-js";
import { createOptimisticFlags } from "../src/flags";
import { inRoot } from "../src/testing";

const sleep = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a held flag shows until its action ends, then the base shows", async () => {
  const { value: flags, dispose } = inRoot(() => createOptimisticFlags<string>());
  const run = action(function* (commit: boolean) {
    flags.hold("a", true);
    yield sleep();
    if (commit) flags.set("a", true);
  });
  const failed = run(false);
  flush();
  expect(flags.has("a")).toBe(true);
  await failed;
  flush();
  expect(flags.has("a")).toBe(false);
  await run(true);
  flush();
  expect(flags.has("a")).toBe(true);
  dispose();
});
