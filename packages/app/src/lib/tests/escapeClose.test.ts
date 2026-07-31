// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { closeAfterBlur } from "../../../../ui/src/useEscapeClose";

describe("closeAfterBlur", () => {
  test("commits the focused field before closing its panel", () => {
    const events: string[] = [];

    closeAfterBlur(() => events.push("close"), { blur: () => events.push("blur") });

    expect(events).toEqual(["blur", "close"]);
  });

  test("still closes when nothing is focused", () => {
    let closed = false;

    closeAfterBlur(() => {
      closed = true;
    }, null);

    expect(closed).toBe(true);
  });
});
