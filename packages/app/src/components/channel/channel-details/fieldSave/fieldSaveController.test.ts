// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { saveEditableField } from "./fieldSaveController";

describe("saveEditableField", () => {
  test("restores the server value after a rejected edit", async () => {
    const states: boolean[] = [];
    let value = "edited";

    const saved = await saveEditableField({
      next: value,
      persist: async () => false,
      previous: "server value",
      refresh: async () => {},
      restore: (previous) => {
        value = previous;
      },
      setPending: (pending) => states.push(pending),
    });

    expect(saved).toBe(false);
    expect(value).toBe("server value");
    expect(states).toEqual([true, false]);
  });

  test("clears pending after a successful edit even when refresh fails", async () => {
    const states: boolean[] = [];
    const saved = await saveEditableField({
      next: "saved",
      persist: async () => true,
      previous: "old",
      refresh: () => Promise.reject(new Error("offline")),
      restore: () => {
        throw new Error("must not restore a confirmed edit");
      },
      setPending: (pending) => states.push(pending),
    });

    expect(saved).toBe(true);
    expect(states).toEqual([true, false]);
  });
});
