import { afterEach, beforeEach, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import { createSignal, flush, Show } from "solid-js";
import { startFakeEnv } from "../fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;
let dispose: (() => void) | undefined;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  fake.stop();
});

async function openOverlay() {
  const { default: Overlay } = await import("../../../packages/ui/src/overlay/Overlay");
  const before = document.createElement("input");
  const after = document.createElement("input");
  const host = document.createElement("div");
  document.body.append(before, after, host);
  before.focus();
  const [open, setOpen] = createSignal(true);
  dispose = render(
    () => (
      <Show when={open()}>
        <Overlay ariaLabel="test" onClose={() => setOpen(false)}>
          <button type="button">inside</button>
        </Overlay>
      </Show>
    ),
    host,
  );
  flush();
  await Promise.resolve();
  const close = () => {
    setOpen(false);
    flush();
  };
  return { after, before, close };
}

test("closing gives focus back", async () => {
  const { before, close } = await openOverlay();
  expect(document.activeElement).not.toBe(before);
  close();
  await Promise.resolve();
  expect(document.activeElement).toBe(before);
});

test("closing leaves focus that something else took", async () => {
  const { after, close } = await openOverlay();
  close();
  after.focus();
  await Promise.resolve();
  expect(document.activeElement).toBe(after);
});
