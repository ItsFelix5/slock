import { describe, expect, test } from "bun:test";
import { createFakeEnv } from "@slock/core/testing";
import { createUi } from "../src/ui";

function twoInstances() {
  return [createUi(createFakeEnv()), createUi(createFakeEnv())] as const;
}

const shortcut = {
  combo: { key: "x" },
  group: "App",
  handler: () => {},
  id: "test.one",
  label: "One",
  scope: "general",
} as const;

describe("createUi", () => {
  test("shortcut registries are independent", () => {
    const [a, b] = twoInstances();
    const unregister = a.shortcuts.register(shortcut);
    expect(a.shortcuts.list()).toHaveLength(1);
    expect(b.shortcuts.list()).toEqual([]);
    unregister();
    a.dispose();
    b.dispose();
  });

  test("only the owning registry reacts to keydown", () => {
    const [a, b] = twoInstances();
    const log: string[] = [];
    b.shortcuts.register({ ...shortcut, handler: () => log.push("b") });
    a.shortcuts.register({ ...shortcut, handler: () => log.push("a") });
    a.dispose();
    document.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, key: "x" }));
    expect(log).toEqual(["b"]);
    b.dispose();
  });

  test("keybind overrides only affect their own registry", () => {
    const [a, b] = twoInstances();
    a.shortcuts.register(shortcut);
    b.shortcuts.register(shortcut);
    a.keybinds.set("test.one", { key: "y" });
    expect(a.shortcuts.list()[0]?.isCustom).toBe(true);
    expect(b.shortcuts.list()[0]?.isCustom).toBe(false);
    a.dispose();
    b.dispose();
  });

  test("dispose empties the registry and detaches the listener", () => {
    const [a] = twoInstances();
    const log: string[] = [];
    a.shortcuts.register({ ...shortcut, handler: () => log.push("a") });
    a.dispose();
    expect(a.shortcuts.list()).toEqual([]);
    document.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, key: "x" }));
    expect(log).toEqual([]);
  });

  test("focus and escape layers are independent", () => {
    const [a, b] = twoInstances();
    const focus = a.focusLayers.push({});
    const closer = a.escapeLayers.push({ enabled: () => true, onClose: () => {}, owner: null });
    expect(b.focusLayers.isTop(focus)).toBe(false);
    expect(b.escapeLayers.findLast(() => true)).toBeUndefined();
    expect(a.escapeLayers.findLast(() => true)).toBe(closer);
    a.dispose();
    b.dispose();
  });

  test("fetch queues have separate limits", async () => {
    const [a, b] = twoInstances();
    const release: (() => void)[] = [];
    const hold = () => new Promise<void>((resolve) => release.push(resolve));
    for (let i = 0; i < 4; i++) void a.backgroundFetchQueue.run(hold);
    let started = false;
    const queued = a.backgroundFetchQueue.run(() => {
      started = true;
      return Promise.resolve();
    });
    await b.backgroundFetchQueue.run(() => Promise.resolve());
    expect(started).toBe(false);
    for (const resolve of release) resolve();
    await queued;
    expect(started).toBe(true);
    a.dispose();
    b.dispose();
  });
});
