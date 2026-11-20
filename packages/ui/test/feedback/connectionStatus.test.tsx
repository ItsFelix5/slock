import { afterEach, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import ConnectionStatus, { type ConnectionStatusState } from "../../src/feedback/ConnectionStatus";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

test("the pill stays mounted so it can fade, and is shown only while not connected", () => {
  const [state, setState] = createSignal<ConnectionStatusState>("connected");
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => <ConnectionStatus onRetry={() => {}} state={state()} />, host);

  const pill = host.querySelector(".connection-status");
  expect(pill?.classList.contains("connection-status-shown")).toBe(false);

  setState("offline");
  flush();
  expect(host.querySelector(".connection-status")).toBe(pill);
  expect(pill?.classList.contains("connection-status-shown")).toBe(true);

  setState("connected");
  flush();
  expect(pill?.classList.contains("connection-status-shown")).toBe(false);
});
