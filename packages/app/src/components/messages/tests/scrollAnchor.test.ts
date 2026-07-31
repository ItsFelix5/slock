// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { flashMessageWhenRendered } from "../scrollAnchor";

function createRenderHarness() {
  const added: string[] = [];
  let rendered: HTMLElement | null = null;
  const target = {
    classList: {
      add: (name: string) => added.push(name),
      remove: () => {},
    },
  } as unknown as HTMLElement;
  const container = {
    querySelector: () => rendered,
  } as unknown as HTMLElement;
  return { added, container, render: () => (rendered = target) };
}

describe("flashMessageWhenRendered", () => {
  const originalCss = globalThis.CSS;
  const OriginalMutationObserver = globalThis.MutationObserver;
  let mutationCallback: MutationCallback | undefined;
  let observerDisconnected = false;

  beforeEach(() => {
    observerDisconnected = false;
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      value: class implements MutationObserver {
        constructor(callback: MutationCallback) {
          mutationCallback = callback;
        }

        disconnect() {
          observerDisconnected = true;
        }

        observe() {}

        takeRecords(): MutationRecord[] {
          return [];
        }
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "CSS", { configurable: true, value: originalCss });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      value: OriginalMutationObserver,
    });
  });

  test("flashes a row that mounts after the jump starts", () => {
    const harness = createRenderHarness();

    flashMessageWhenRendered(harness.container, "123.456");
    expect(harness.added).toEqual([]);

    harness.render();
    mutationCallback?.([], {} as MutationObserver);

    expect(harness.added).toEqual(["message-flash"]);
    expect(observerDisconnected).toBe(true);
  });

  test("does not flash after cancellation", () => {
    const harness = createRenderHarness();

    const cancel = flashMessageWhenRendered(harness.container, "123.456");
    cancel();
    harness.render();
    mutationCallback?.([], {} as MutationObserver);

    expect(harness.added).toEqual([]);
  });
});
