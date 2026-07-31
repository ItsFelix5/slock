// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createCopyFeedback } from "../../../../ui/src/feedback/copyFeedback";

describe("createCopyFeedback", () => {
  test("shows success only after the clipboard write succeeds", async () => {
    let resolveWrite: () => void = () => {};
    const write = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const [copied, copy] = createCopyFeedback(0, undefined, () => write);

    const result = copy("value", "field");
    expect(copied()).toBeNull();
    resolveWrite();
    expect(await result).toBe(true);
    expect(copied()).toBe("field");
  });

  test("keeps success clear and reports rejected clipboard writes", async () => {
    let errors = 0;
    const [copied, copy] = createCopyFeedback(
      0,
      () => {
        errors++;
      },
      () => Promise.reject(new Error("denied")),
    );

    expect(await copy("value", "field")).toBe(false);
    expect(copied()).toBeNull();
    expect(errors).toBe(1);
  });

  test("ignores stale feedback when overlapping writes settle out of order", async () => {
    const resolvers: Array<() => void> = [];
    const [copied, copy] = createCopyFeedback(
      10_000,
      undefined,
      () => new Promise<void>((resolve) => resolvers.push(resolve)),
    );

    const first = copy("one", "first");
    const second = copy("two", "second");
    resolvers[1]?.();
    expect(await second).toBe(true);
    expect(copied()).toBe("second");

    resolvers[0]?.();
    expect(await first).toBe(true);
    expect(copied()).toBe("second");
  });
});
