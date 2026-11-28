import { beforeEach, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { flush } from "solid-js";
import { createModalsSlice } from "../../../../packages/plugins/src/view-modals/client/store";
import { createFakeEnv, type FakeEnv } from "../../../support/core";

let env: FakeEnv;

beforeEach(async () => {
  env = createFakeEnv(1, 1_000_000);
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register();
});

function advance(ms: number) {
  env.advance(ms);
  flush();
}

test("a toast hides 4 s after it was shown", () => {
  const modals = createModalsSlice();
  modals.showToast("Sent");
  flush();
  advance(3999);
  expect(modals.toast()).toBe("Sent");
  advance(1);
  expect(modals.toast()).toBeNull();
});

test("a newer toast restarts the hide timer", () => {
  const modals = createModalsSlice();
  modals.showToast("Sent");
  advance(3000);
  modals.showToast("Saved");
  flush();
  advance(3999);
  expect(modals.toast()).toBe("Saved");
  advance(1);
  expect(modals.toast()).toBeNull();
});

test("dispose cancels a pending hide", () => {
  const modals = createModalsSlice();
  modals.showToast("Sent");
  modals.dispose();
  advance(10_000);
  expect(modals.toast()).toBe("Sent");
});
