// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createCanvasSaveController } from "./canvasSaveController";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness(persist: (fileId: string, snapshot: string) => Promise<boolean>) {
  let currentText = "first draft";
  let dirty = true;
  let saving = false;
  const saved: string[] = [];
  const controller = createCanvasSaveController({
    dirty: () => dirty,
    fileId: () => "F123",
    onSaved: (snapshot) => saved.push(snapshot),
    persist,
    setDirty: (value) => {
      dirty = value;
    },
    setSaving: (value) => {
      saving = value;
    },
    text: () => currentText,
  });
  return {
    controller,
    dirty: () => dirty,
    saved,
    saving: () => saving,
    updateText: (value: string) => {
      currentText = value;
      dirty = true;
    },
  };
}

describe("createCanvasSaveController", () => {
  test("keeps newer edits dirty while an older snapshot saves", async () => {
    const request = deferred<boolean>();
    const harness = createHarness(() => request.promise);

    const saving = harness.controller.save();
    harness.updateText("newer draft");
    request.resolve(true);

    expect(await saving).toBe(true);
    expect(harness.saved).toEqual(["first draft"]);
    expect(harness.dirty()).toBe(true);
    expect(harness.saving()).toBe(false);
  });

  test("flushes the latest edit before allowing close", async () => {
    const snapshots: string[] = [];
    let harness!: ReturnType<typeof createHarness>;
    harness = createHarness((_id, snapshot) => {
      snapshots.push(snapshot);
      if (snapshots.length === 1) harness.updateText("newer draft");
      return Promise.resolve(true);
    });

    expect(await harness.controller.flush()).toBe(true);
    expect(snapshots).toEqual(["first draft", "newer draft"]);
    expect(harness.dirty()).toBe(false);
  });

  test("leaves failed content dirty", async () => {
    const harness = createHarness(() => Promise.resolve(false));

    expect(await harness.controller.flush()).toBe(false);
    expect(harness.saved).toEqual([]);
    expect(harness.dirty()).toBe(true);
  });
});
