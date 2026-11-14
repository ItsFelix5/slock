import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { localEnabledStore } from "../src/enabledStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function install(storage: object) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

beforeEach(() => install(fakeStorage()));

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("localEnabledStore", () => {
  test("reads nothing from an empty storage", () => {
    expect(localEnabledStore("enabled").read()).toEqual({});
  });

  test("writes then reads the same overrides", () => {
    const store = localEnabledStore("enabled");
    store.write({ canvas: false, search: true });
    expect(store.read()).toEqual({ canvas: false, search: true });
  });

  test("keeps keys apart", () => {
    localEnabledStore("a").write({ x: true });
    expect(localEnabledStore("b").read()).toEqual({});
  });

  test("keeps only boolean values", () => {
    install(fakeStorage({ enabled: '{"a":true,"b":"yes","c":0,"d":null,"e":false,"f":{}}' }));
    expect(localEnabledStore("enabled").read()).toEqual({ a: true, e: false });
  });

  test("reads nothing from stored garbage", () => {
    for (const raw of ["{nope", "[true]", "null", "7", '"x"', "true"]) {
      install(fakeStorage({ enabled: raw }));
      expect(localEnabledStore("enabled").read()).toEqual({});
    }
  });

  test("survives a storage that throws", () => {
    install({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    });
    const store = localEnabledStore("enabled");
    expect(store.read()).toEqual({});
    expect(() => store.write({ a: true })).not.toThrow();
  });

  test("survives a missing storage", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    const store = localEnabledStore("enabled");
    expect(store.read()).toEqual({});
    expect(() => store.write({ a: true })).not.toThrow();
  });
});
