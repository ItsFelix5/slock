// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createDraftPersistenceGate, saveAfterDraftHydration } from "./draftSyncGuards";

describe("draft sync guards", () => {
  test("treats the first value for each destination as a non-persisted baseline", () => {
    const gate = createDraftPersistenceGate();
    expect(gate.shouldPersist("channel-a")).toBe(false);
    expect(gate.shouldPersist("channel-a")).toBe(true);
    expect(gate.shouldPersist("channel-b")).toBe(false);
    expect(gate.shouldPersist("channel-b")).toBe(true);
  });

  test("does not save before draft ids have hydrated", async () => {
    let saves = 0;
    expect(
      await saveAfterDraftHydration(
        () => Promise.resolve(false),
        () => {
          saves++;
          return Promise.resolve();
        },
      ),
    ).toBe(false);
    expect(saves).toBe(0);
  });

  test("saves after hydration succeeds", async () => {
    let saves = 0;
    expect(
      await saveAfterDraftHydration(
        () => Promise.resolve(true),
        () => {
          saves++;
          return Promise.resolve();
        },
      ),
    ).toBe(true);
    expect(saves).toBe(1);
  });
});
