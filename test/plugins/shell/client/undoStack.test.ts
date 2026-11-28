import { describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { createUndoStack } from "../../../../packages/plugins/src/shell/client/undoStack";

const newStack = () => createRoot(() => createUndoStack());

describe("createUndoStack", () => {
  test("undoes the most recent action first and reports its label", async () => {
    const stack = newStack();
    const ran: string[] = [];
    stack.push({ label: "first", undo: () => void ran.push("first") });
    stack.push({ label: "second", undo: () => void ran.push("second") });
    expect(await stack.undo()).toBe("second");
    expect(await stack.undo()).toBe("first");
    expect(ran).toEqual(["second", "first"]);
  });

  test("returns undefined when there is nothing to undo", async () => {
    expect(await newStack().undo()).toBeUndefined();
  });

  test("waits for an async undo before resolving", async () => {
    const stack = newStack();
    let finished = false;
    stack.push({
      label: "slow",
      undo: async () => {
        await Promise.resolve();
        finished = true;
      },
    });
    await stack.undo();
    expect(finished).toBe(true);
  });

  test("two undo calls in a row take two different entries", async () => {
    const stack = newStack();
    const ran: string[] = [];
    for (const label of ["a", "b", "c"]) stack.push({ label, undo: () => void ran.push(label) });
    await Promise.all([stack.undo(), stack.undo()]);
    expect(ran).toEqual(["c", "b"]);
  });

  test("an entry is consumed even when its undo rejects", async () => {
    const stack = newStack();
    stack.push({ label: "bad", undo: () => Promise.reject(new Error("gone")) });
    await expect(stack.undo()).rejects.toThrow("gone");
    expect(await stack.undo()).toBeUndefined();
  });

  test("keeps only the 30 most recent entries", async () => {
    const stack = newStack();
    for (let i = 0; i < 35; i++) stack.push({ label: String(i), undo: () => {} });
    const labels: string[] = [];
    for (let label = await stack.undo(); label; label = await stack.undo()) labels.push(label);
    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe("34");
    expect(labels.at(-1)).toBe("5");
  });
});
