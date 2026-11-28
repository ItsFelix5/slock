import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { Button, Modal, ModalHeader } from "@slock/ui";
import { createSignal, onSettled, Show } from "solid-js";
import { type Decoded, decodeImage } from "../lib/decode";
import { cropRect, defaultEdits, type Edits, selectedFrames } from "../lib/edits";
import { encodeImage } from "../lib/encode";
import { drawEdits } from "../lib/render";
import EditorControls from "./EditorControls";
import "./ImageEditor.css";

const env = service("env");

const IDLE_TICK_MS = 100;

export default function ImageEditor(props: {
  file: File;
  onCancel: () => void;
  onSave: (file: File) => void;
}) {
  const [decoded, setDecoded] = createSignal<Decoded>();
  const [edits, setEdits] = createSignal<Edits>(defaultEdits(1));
  const [error, setError] = createSignal<string>();
  const [progress, setProgress] = createSignal<number>();
  let canvas: HTMLCanvasElement | undefined;

  const saving = () => progress() !== undefined;
  const cancel = () => !saving() && props.onCancel();

  onSettled(() => {
    const abort = new AbortController();
    decodeImage(props.file, abort.signal)
      .then((next) => {
        setEdits(defaultEdits(next.frames.length));
        setDecoded(next);
      })
      .catch((e) => !abort.signal.aborted && setError(errorMessage(e)));
    return () => abort.abort();
  });

  onSettled(() => {
    let index = 0;
    let timer: ReturnType<typeof env.setTimeout> | undefined;
    const tick = () => {
      const current = decoded();
      const frames = current ? selectedFrames(current.frames, edits()) : [];
      const shown = frames[index % Math.max(1, frames.length)];
      if (!(current && canvas && shown)) {
        timer = env.setTimeout(tick, IDLE_TICK_MS);
        return;
      }
      drawEdits(
        canvas,
        shown.frame.image,
        cropRect(edits().crop, current.width, current.height),
        edits(),
      );
      index++;
      timer = env.setTimeout(tick, shown.delay);
    };
    tick();
    return () => env.clearTimeout(timer);
  });

  async function save() {
    const current = decoded();
    if (!current) return;
    setError(undefined);
    setProgress(0);
    try {
      props.onSave(await encodeImage(current, edits(), props.file.name, setProgress));
    } catch (e) {
      setError(errorMessage(e));
      setProgress(undefined);
    }
  }

  return (
    <Modal ariaLabel="Edit image" class="image-editor" onClose={cancel}>
      <ModalHeader onClose={cancel} title="Edit image" />
      <div class="image-editor-content">
        <div class="image-editor-stage">
          <canvas class="image-editor-canvas" ref={canvas} />
        </div>
        <Show when={decoded()}>
          {(current) => (
            <EditorControls
              edits={edits()}
              frameCount={current().frames.length}
              onChange={setEdits}
            />
          )}
        </Show>
        <Show when={error()}>{(message) => <p class="image-editor-error">{message()}</p>}</Show>
      </div>
      <div class="image-editor-actions flex-between">
        <Button disabled={saving()} onClick={props.onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={saving() || !decoded()} onClick={() => void save()} variant="primary">
          {saving() ? `Saving ${Math.round((progress() ?? 0) * 100)}%` : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
