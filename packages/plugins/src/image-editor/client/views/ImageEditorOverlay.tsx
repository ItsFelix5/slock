import { lazyChunk, service } from "@slock/core/solid";
import { Show } from "solid-js";

const ImageEditor = lazyChunk(() => import("./ImageEditor"));
const editor = service("image-editor");

export default function ImageEditorOverlay() {
  return (
    <Show keyed when={editor.session()}>
      {(session) => (
        <ImageEditor
          file={session.file}
          onCancel={() => session.finish(undefined)}
          onSave={session.finish}
        />
      )}
    </Show>
  );
}
