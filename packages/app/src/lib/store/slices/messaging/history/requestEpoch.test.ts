// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createRequestEpochs } from "./requestEpoch";

describe("createRequestEpochs", () => {
  test("invalidates stale work without affecting another conversation", () => {
    const epochs = createRequestEpochs();
    const first = epochs.begin("C1");
    const other = epochs.begin("C2");
    const second = epochs.begin("C1");

    expect(epochs.isCurrent("C1", first)).toBe(false);
    expect(epochs.isCurrent("C1", second)).toBe(true);
    expect(epochs.isCurrent("C2", other)).toBe(true);
  });
});
