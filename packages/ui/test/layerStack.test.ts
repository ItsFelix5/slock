import { describe, expect, test } from "bun:test";
import { createLayerStack } from "../src/layerStack";

describe("layer stack", () => {
  test("the newest layer is on top", () => {
    const stack = createLayerStack<object>();
    const first = stack.push({});
    const second = stack.push({});
    expect(stack.isTop(second)).toBe(true);
    expect(stack.isTop(first)).toBe(false);
  });

  test("popping the top layer reveals the one below", () => {
    const stack = createLayerStack<object>();
    const first = stack.push({});
    const second = stack.push({});
    const result = stack.pop(second);
    expect(result.wasTop).toBe(true);
    expect(result.revealed).toBe(first);
    expect(stack.isTop(first)).toBe(true);
  });

  test("popping a covered layer leaves the top alone", () => {
    const stack = createLayerStack<object>();
    const first = stack.push({});
    const second = stack.push({});
    const result = stack.pop(first);
    expect(result.wasTop).toBe(false);
    expect(result.revealed).toBe(second);
  });

  test("popping twice is harmless and an empty stack has no top", () => {
    const stack = createLayerStack<object>();
    const layer = stack.push({});
    stack.pop(layer);
    const again = stack.pop(layer);
    expect(again.wasTop).toBe(false);
    expect(again.revealed).toBeUndefined();
    expect(stack.isTop(undefined)).toBe(true);
  });

  test("findLast searches from the top", () => {
    const stack = createLayerStack<{ id: number }>();
    stack.push({ id: 1 });
    stack.push({ id: 2 });
    expect(stack.findLast((layer) => layer.id < 3)?.id).toBe(2);
    expect(stack.findLast((layer) => layer.id > 2)).toBeUndefined();
  });

  test("stacks do not share layers", () => {
    const a = createLayerStack<object>();
    const b = createLayerStack<object>();
    const layer = a.push({});
    expect(b.isTop(layer)).toBe(false);
    expect(b.isTop(undefined)).toBe(true);
  });
});
