import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import {
  createPendingFileState,
  createPendingFilesStore,
} from "../../../../../packages/plugins/src/composer/client/lib/pendingFiles";

describe("pending files store", () => {
  test("files added through the store reach a mounted composer", () => {
    const store = createPendingFilesStore();
    let dispose = () => {};
    const state = createRoot((done) => {
      dispose = done;
      return createPendingFileState({
        disabled: () => false,
        draftKey: () => "C1",
        store,
        uploadOnAttach: () => false,
      });
    });
    const file = new File(["x"], "meme.gif", { type: "image/gif" });
    store.set("C1", [file]);
    flush();
    expect(state.files()).toEqual([file]);
    store.set("C2", [new File(["y"], "other.gif")]);
    flush();
    expect(state.files()).toEqual([file]);
    dispose();
  });
});
