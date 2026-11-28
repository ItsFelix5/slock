import { describe, expect, test } from "bun:test";
import {
  backspaceSlots,
  fillSlots,
  toSlots,
  typedDigits,
} from "../../../packages/ui/src/form/otpSlots";

describe("toSlots", () => {
  test("pads the value to the length", () => {
    expect(toSlots("12", 4)).toEqual(["1", "2", "", ""]);
  });
});

describe("typedDigits", () => {
  test("drops everything that is not a digit", () => {
    expect(typedDigits("a1-2", "")).toEqual(["1", "2"]);
  });

  test("typing over a filled slot keeps only the new digit", () => {
    expect(typedDigits("17", "1")).toEqual(["7"]);
  });

  test("a pasted run that happens to start with the current digit still loses it", () => {
    expect(typedDigits("123", "1")).toEqual(["2", "3"]);
  });

  test("a single digit equal to the current one stays", () => {
    expect(typedDigits("1", "1")).toEqual(["1"]);
  });

  test("no digits means nothing was typed", () => {
    expect(typedDigits("x", "")).toEqual([]);
  });
});

describe("fillSlots", () => {
  test("writes digits from the index and reports how many fit", () => {
    expect(fillSlots(["", "", "", ""], 1, ["1", "2"])).toEqual({
      next: ["", "1", "2", ""],
      room: 2,
    });
  });

  test("drops digits past the last slot", () => {
    expect(fillSlots(["", "", ""], 1, ["1", "2", "3"])).toEqual({
      next: ["", "1", "2"],
      room: 2,
    });
  });

  test("does not mutate its input", () => {
    const slots = ["", ""];
    fillSlots(slots, 0, ["9"]);
    expect(slots).toEqual(["", ""]);
  });
});

describe("backspaceSlots", () => {
  test("clears a filled slot in place", () => {
    expect(backspaceSlots(["1", "2"], 1)).toEqual({ next: ["1", ""] });
  });

  test("on an empty slot clears the previous one and moves back", () => {
    expect(backspaceSlots(["1", "2", ""], 2)).toEqual({ focus: 1, next: ["1", "", ""] });
  });

  test("on an empty first slot does nothing", () => {
    expect(backspaceSlots(["", "2"], 0)).toBeUndefined();
  });

  test("an unknown slot does nothing", () => {
    expect(backspaceSlots(["1"], -1)).toBeUndefined();
  });
});
