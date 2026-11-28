import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import {
  createPendingFileState,
  createPendingFilesStore,
} from "../../../../../packages/plugins/src/composer/client/lib/pendingFiles";

function setup(disabled = false) {
  return createRoot(() =>
    createPendingFileState({
      disabled: () => disabled,
      draftKey: () => "C1",
      store: createPendingFilesStore(),
      uploadOnAttach: () => false,
    }),
  );
}

describe("pending files replace", () => {
  test("swaps the matching file in place", () => {
    const state = setup();
    const [a, b, edited] = [
      new File(["a"], "a.png"),
      new File(["b"], "b.png"),
      new File(["c"], "c.png"),
    ];
    state.add([a, b]);
    flush();
    state.replace(a, edited);
    flush();
    expect(state.files()).toEqual([edited, b]);
  });

  test("ignores a file that was removed meanwhile", () => {
    const state = setup();
    const a = new File(["a"], "a.png");
    state.add([a]);
    flush();
    state.remove(0);
    flush();
    state.replace(a, new File(["c"], "c.png"));
    flush();
    expect(state.files()).toEqual([]);
  });

  test("does nothing while disabled", () => {
    const state = setup(true);
    const a = new File(["a"], "a.png");
    state.replace(a, new File(["c"], "c.png"));
    flush();
    expect(state.files()).toEqual([]);
  });
});
