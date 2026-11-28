import { describe, expect, test } from "bun:test";
import { createPref } from "../../packages/core/src";
import {
  parseRecordOf,
  parseString,
  textCodec,
} from "../../packages/plugins/src/appearance/client/theme/themePrefs";
import { parseLike } from "../../packages/plugins/src/slack/client/api/localPref";
import { createFakeEnv } from "../support/core";

type Shape = { n: number };
const parseShape = (value: unknown): Shape | undefined =>
  typeof value === "object" && value !== null && "n" in value && typeof value.n === "number"
    ? { n: value.n }
    : undefined;

function shapePref(env = createFakeEnv()) {
  return {
    env,
    pref: createPref<Shape>(env.storage, { fallback: { n: 0 }, key: "k", parse: parseShape }),
  };
}

describe("createPref", () => {
  test("round-trips through storage", () => {
    const { env, pref } = shapePref();
    expect(pref.set({ n: 3 })).toBe(true);
    expect(env.storage.get("k")).toBe('{"n":3}');
    expect(shapePref(env).pref.get()).toEqual({ n: 3 });
  });

  test("falls back on corrupt JSON and on schema mismatch, leaving the stored text alone", () => {
    for (const raw of ["{nope", '{"n":"x"}', "[]", "null"]) {
      const env = createFakeEnv();
      env.storage.set("k", raw);
      expect(shapePref(env).pref.get()).toEqual({ n: 0 });
      expect(env.storage.get("k")).toBe(raw);
    }
  });

  test("blocked storage keeps working in memory", () => {
    const blocked = {
      ...createFakeEnv().storage,
      get: () => {
        throw new Error("denied");
      },
      remove: () => {
        throw new Error("denied");
      },
      set: () => {
        throw new Error("denied");
      },
    };
    const pref = createPref<Shape>(blocked, { fallback: { n: 0 }, key: "k", parse: parseShape });
    expect(pref.get()).toEqual({ n: 0 });
    expect(pref.set({ n: 2 })).toBe(false);
    expect(pref.get()).toEqual({ n: 2 });
    expect(() => pref.reset()).not.toThrow();
    expect(pref.get()).toEqual({ n: 0 });
  });

  test("reset removes the stored value", () => {
    const { env, pref } = shapePref();
    pref.set({ n: 1 });
    pref.reset();
    expect(env.storage.get("k")).toBeNull();
    expect(pref.get()).toEqual({ n: 0 });
  });

  test("a parser returning null is a valid value, not a mismatch", () => {
    const env = createFakeEnv();
    env.storage.set("k", "null");
    const pref = createPref<string | null>(env.storage, {
      fallback: "x",
      key: "k",
      parse: (value) => (value === null ? null : parseString(value)),
    });
    expect(pref.get()).toBeNull();
  });

  test("text codec stores values unquoted", () => {
    const env = createFakeEnv();
    const pref = createPref(env.storage, {
      codec: textCodec,
      fallback: "a",
      key: "t",
      parse: parseString,
    });
    pref.set("b c");
    expect(env.storage.get("t")).toBe("b c");
    expect(pref.get()).toBe("b c");
  });

  test("cross-tab updates reach listeners for its own key only, and stop after unsubscribe", () => {
    const { env, pref } = shapePref();
    const seen: Shape[] = [];
    const stop = pref.onRemoteChange((value) => seen.push(value));
    env.writeRemote("other", '{"n":9}');
    env.writeRemote("k", '{"n":5}');
    env.writeRemote("k", "garbage");
    expect(seen).toEqual([{ n: 5 }, { n: 0 }]);
    expect(pref.get()).toEqual({ n: 0 });
    stop();
    env.writeRemote("k", '{"n":7}');
    expect(seen).toHaveLength(2);
    expect(pref.get()).toEqual({ n: 0 });
  });
});

describe("parsers", () => {
  test("parseLike checks the kind of the sample", () => {
    expect(parseLike(false)(true)).toBe(true);
    expect(parseLike(false)("true")).toBeUndefined();
    expect(parseLike<string[]>([])({})).toBeUndefined();
    expect(parseLike<string[]>([])(["a"])).toEqual(["a"]);
    expect(parseLike<boolean | null>(null)(true)).toBe(true);
    expect(parseLike<boolean | null>(null)({})).toBeUndefined();
    expect(parseLike({ a: 1 })([])).toBeUndefined();
  });

  test("parseRecordOf drops invalid entries and rejects non-records", () => {
    const parse = parseRecordOf(parseString);
    expect(parse({ a: "x", b: 1 })).toEqual({ a: "x" });
    expect(parse([])).toBeUndefined();
    expect(parse("s")).toBeUndefined();
  });
});
