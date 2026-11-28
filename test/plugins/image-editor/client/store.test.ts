import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createImageEditorStore } from "../../../../packages/plugins/src/image-editor/client/store";

const file = (name: string) => new File(["x"], name, { type: "image/png" });

describe("image editor store", () => {
  test("resolves with the edited file and clears the session", async () => {
    const store = createRoot(() => createImageEditorStore());
    const original = file("a.png");
    const edited = file("b.png");
    const result = store.edit(original);
    flush();
    expect(store.session()?.file).toBe(original);
    store.session()?.finish(edited);
    flush();
    expect(await result).toBe(edited);
    expect(store.session()).toBeUndefined();
  });

  test("resolves undefined when cancelled", async () => {
    const store = createRoot(() => createImageEditorStore());
    const result = store.edit(file("a.png"));
    flush();
    store.session()?.finish(undefined);
    flush();
    expect(await result).toBeUndefined();
  });

  test("opening another edit cancels the pending one", async () => {
    const store = createRoot(() => createImageEditorStore());
    const first = store.edit(file("a.png"));
    flush();
    const second = file("b.png");
    void store.edit(second);
    flush();
    expect(await first).toBeUndefined();
    expect(store.session()?.file).toBe(second);
  });
});
