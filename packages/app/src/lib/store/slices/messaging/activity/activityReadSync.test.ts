// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createActivityReadSync } from "./activityReadSync";

describe("createActivityReadSync", () => {
  test("exposes a failed cursor and clears it after retry", async () => {
    let shouldFail = true;
    const sync = createActivityReadSync(() => Promise.resolve(!shouldFail));

    await sync.request("C1", "1.000001");
    expect(sync.error()).toBe(true);
    expect(sync.isPending()).toBe(false);

    shouldFail = false;
    await sync.retry();
    expect(sync.error()).toBe(false);
    expect(sync.isPending()).toBe(false);
  });
});
