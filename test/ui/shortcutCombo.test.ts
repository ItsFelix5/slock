import { describe, expect, test } from "bun:test";
import {
  comboFromEvent,
  comboLabel,
  comboParts,
  combosOverlap,
  type KeyInput,
  matchesCombo,
  type ShortcutCombo,
} from "../../packages/ui/src/shortcutCombo";
import { forAll, pick } from "../support/core";

const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  altKey: false,
  code: "",
  ctrlKey: false,
  key,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

describe("matchesCombo", () => {
  test("mod means ctrl off Mac and cmd on Mac, never the other one", () => {
    const combo: ShortcutCombo = { key: "k", mod: true };
    expect(matchesCombo(press("k", { ctrlKey: true }), combo, false, false)).toBe(true);
    expect(matchesCombo(press("k", { metaKey: true }), combo, false, false)).toBe(false);
    expect(matchesCombo(press("k", { metaKey: true }), combo, false, true)).toBe(true);
    expect(matchesCombo(press("k", { ctrlKey: true }), combo, false, true)).toBe(false);
  });

  test("a combo without mod rejects a pressed mod", () => {
    expect(matchesCombo(press("k", { ctrlKey: true }), { key: "k" }, false, false)).toBe(false);
  });

  test("the other system key never matches or records", () => {
    const both = press("k", { ctrlKey: true, metaKey: true });
    expect(matchesCombo(press("k", { ctrlKey: true }), { key: "k" }, false, true)).toBe(false);
    expect(matchesCombo(press("k", { metaKey: true }), { key: "k" }, false, false)).toBe(false);
    expect(matchesCombo(both, { key: "k", mod: true }, false, true)).toBe(false);
    expect(comboFromEvent(press("k", { ctrlKey: true }), true)).toBeNull();
    expect(comboFromEvent(press("k", { metaKey: true }), false)).toBeNull();
  });

  test("shift and alt must match exactly", () => {
    expect(matchesCombo(press("a", { shiftKey: true }), { key: "a" })).toBe(false);
    expect(matchesCombo(press("a"), { key: "a", shift: true })).toBe(false);
    expect(matchesCombo(press("a", { altKey: true }), { alt: true, key: "a" })).toBe(true);
    expect(matchesCombo(press("a", { altKey: true }), { key: "a" })).toBe(false);
  });

  test("splitModifier ignores shift on either side", () => {
    expect(matchesCombo(press("Enter", { shiftKey: true }), { key: "Enter" }, true)).toBe(true);
    expect(matchesCombo(press("Enter"), { key: "Enter", shift: true }, true)).toBe(true);
  });

  test("a non-Latin layout matches letters by physical key, a Latin layout does not", () => {
    const combo: ShortcutCombo = { key: "k" };
    expect(matchesCombo(press("л", { code: "KeyK" }), combo)).toBe(true);
    expect(matchesCombo(press("л", { code: "KeyL" }), combo)).toBe(false);
    expect(matchesCombo(press("t", { code: "KeyK" }), combo)).toBe(false);
  });

  test("compares keys without case and accepts any key in a list", () => {
    expect(matchesCombo(press("K"), { key: "k" })).toBe(true);
    expect(matchesCombo(press("ArrowUp"), { key: ["ArrowUp", "k"] })).toBe(true);
    expect(matchesCombo(press("j"), { key: ["ArrowUp", "k"] })).toBe(false);
  });

  test("slash falls back to the physical key on layouts that need shift", () => {
    expect(matchesCombo(press("?", { code: "Slash" }), { key: "/" }, true)).toBe(true);
    expect(matchesCombo(press("?", { code: "KeyA" }), { key: "/" }, true)).toBe(false);
  });
});

describe("keyboard layouts", () => {
  const windows = (key: string, code: string) => press(key, { altKey: true, code, ctrlKey: true });

  test("characters typed with AltGr trigger no shortcut", () => {
    for (const [key, letter] of [
      ["µ", "m"],
      ["€", "e"],
      ["ą", "a"],
    ] as const) {
      const input = windows(key, `Key${letter.toUpperCase()}`);
      expect(matchesCombo(input, { alt: true, key: letter, mod: true }, false, false)).toBe(false);
    }
  });

  test("Ctrl Alt on a non-Latin layout still matches by physical key", () => {
    const input = windows("ь", "KeyM");
    expect(matchesCombo(input, { alt: true, key: "m", mod: true }, false, false)).toBe(true);
  });

  test("Mac Option symbols and dead keys match by physical key", () => {
    for (const key of ["∂", "Dead"]) {
      const input = press(key, { altKey: true, code: "KeyD", metaKey: true });
      expect(matchesCombo(input, { alt: true, key: "d", mod: true }, false, true)).toBe(true);
    }
  });

  test("the minus key in the slash position stays free for zoom", () => {
    const zoom = press("-", { code: "Slash", ctrlKey: true });
    expect(matchesCombo(zoom, { key: "/", mod: true }, false, false)).toBe(false);
  });

  test("a symbol that needs shift on this layout still matches", () => {
    const input = press("/", { code: "Digit7", ctrlKey: true, shiftKey: true });
    expect(matchesCombo(input, { key: "/", mod: true }, false, false)).toBe(true);
    expect(matchesCombo(press("/"), { key: "/", shift: true })).toBe(false);
  });

  test("recording stores the Latin letter and skips bare dead keys", () => {
    expect(comboFromEvent(press("л", { code: "KeyK" }), false)?.key).toBe("k");
    expect(comboFromEvent(press("∂", { altKey: true, code: "KeyD" }), true)?.key).toBe("d");
    expect(comboFromEvent(press("Dead", { code: "BracketLeft" }), false)).toBeNull();
  });
});

describe("comboFromEvent", () => {
  test("ignores a lone modifier press", () => {
    for (const key of ["Shift", "Control", "Alt", "Meta", "AltGraph", "OS"]) {
      expect(comboFromEvent(press(key))).toBeNull();
    }
  });

  test("lowercases single characters and keeps named keys", () => {
    expect(comboFromEvent(press("Z", { shiftKey: true }), false)).toEqual({
      alt: false,
      key: "z",
      mod: false,
      shift: true,
    });
    expect(comboFromEvent(press("Enter", { metaKey: true }), true)?.key).toBe("Enter");
  });

  test("a recorded combo matches the event it came from", () => {
    const keys = ["a", "Z", "1", "/", "Enter", "ArrowDown", " "];
    forAll(
      (random) => ({
        alt: pick(random, [true, false]),
        ctrl: pick(random, [true, false]),
        key: pick(random, keys),
        mac: pick(random, [true, false]),
        meta: pick(random, [true, false]),
        shift: pick(random, [true, false]),
      }),
      ({ alt, ctrl, key, mac, meta, shift }) => {
        const input = press(key, {
          altKey: alt,
          ctrlKey: ctrl,
          metaKey: meta,
          shiftKey: shift,
        });
        const combo = comboFromEvent(input, mac);
        const matched = combo !== null && matchesCombo(input, combo, false, mac);
        expect(matched).toBe(!(mac ? ctrl : meta));
      },
    );
  });
});

describe("combosOverlap", () => {
  test("needs identical modifiers and one shared key", () => {
    expect(combosOverlap({ key: "k", mod: true }, { key: "K", mod: true })).toBe(true);
    expect(combosOverlap({ key: "k", mod: true }, { key: "k" })).toBe(false);
    expect(combosOverlap({ key: "k", shift: true }, { key: "k" })).toBe(false);
    expect(combosOverlap({ alt: true, key: "k" }, { key: "k" })).toBe(false);
    expect(combosOverlap({ key: ["ArrowUp", "k"] }, { key: "K" })).toBe(true);
    expect(combosOverlap({ key: ["ArrowUp", "k"] }, { key: ["j", "ArrowDown"] })).toBe(false);
  });

  test("is symmetric", () => {
    const combos: ShortcutCombo[] = [
      { key: "k" },
      { key: "K", mod: true },
      { key: ["k", "j"], mod: true },
      { key: "j", shift: true },
    ];
    forAll(
      (random) => [pick(random, combos), pick(random, combos)] as const,
      ([a, b]) => expect(combosOverlap(a, b)).toBe(combosOverlap(b, a)),
    );
  });
});

describe("labels", () => {
  test("uses Cmd on Mac and Ctrl elsewhere", () => {
    expect(comboLabel({ key: "k", mod: true }, true)).toBe("⌘ K");
    expect(comboLabel({ key: "k", mod: true }, false)).toBe("Ctrl K");
  });

  test("orders modifiers and uppercases letters only when a modifier is held", () => {
    expect(comboParts({ alt: true, key: "x", mod: true, shift: true }, false)).toEqual([
      "Ctrl",
      "Shift",
      "Alt",
      "X",
    ]);
    expect(comboParts({ key: "x" })).toEqual(["x"]);
  });

  test("names arrows, space, and escape and joins alternatives", () => {
    expect(comboLabel({ key: ["ArrowUp", "k"] })).toBe("↑ / k");
    expect(comboLabel({ key: " " })).toBe("Space");
    expect(comboLabel({ key: "Escape" })).toBe("Esc");
    expect(comboLabel({ key: "Enter", shift: true })).toBe("Shift Enter");
  });
});
