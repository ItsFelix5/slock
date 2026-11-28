import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { Button, Modal, ModalHeader } from "@slock/ui";
import { createSignal, onSettled, Show } from "solid-js";
import type { MemeTarget } from "../api";
import { type Decoded, decodeImage } from "../lib/decode";
import { encodeMeme } from "../lib/encode";
import { fetchSource } from "../lib/fetchSource";
import { cropRect, defaultMeme, type Meme, selectedFrames } from "../lib/meme";
import { drawMeme } from "../lib/render";
import MemeControls from "./MemeControls";
import "./MemeEditor.css";

const env = service("env");
const composer = service("composer");

const IDLE_TICK_MS = 100;

export default function MemeEditor(props: { onClose: () => void; target: MemeTarget }) {
  const [decoded, setDecoded] = createSignal<Decoded>();
  const [meme, setMeme] = createSignal<Meme>(defaultMeme(1));
  const [error, setError] = createSignal<string>();
  const [progress, setProgress] = createSignal<number>();
  let canvas: HTMLCanvasElement | undefined;

  const saving = () => progress() !== undefined;
  const close = () => !saving() && props.onClose();

  onSettled(() => {
    const abort = new AbortController();
    fetchSource(props.target.source, abort.signal)
      .then((blob) => decodeImage(blob, abort.signal))
      .then((next) => {
        setMeme(defaultMeme(next.frames.length));
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
      const frames = current ? selectedFrames(current.frames, meme()) : [];
      const shown = frames[index % Math.max(1, frames.length)];
      if (!(current && canvas && shown)) {
        timer = env.setTimeout(tick, IDLE_TICK_MS);
        return;
      }
      const rect = cropRect(meme().crop, current.width, current.height);
      drawMeme(canvas, shown.frame.image, rect, meme());
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
      const file = await encodeMeme(current, meme(), props.target.source.name, setProgress);
      composer.attachFiles(props.target, [file]);
      props.onClose();
    } catch (e) {
      setError(errorMessage(e));
      setProgress(undefined);
    }
  }

  return (
    <Modal ariaLabel="Make a meme" class="meme-editor" onClose={close}>
      <ModalHeader onClose={close} title="Make a meme" />
      <div class="meme-editor-content">
        <div class="meme-editor-stage">
          <canvas class="meme-editor-canvas" ref={canvas} />
        </div>
        <Show when={decoded()}>
          {(current) => (
            <MemeControls frameCount={current().frames.length} meme={meme()} onChange={setMeme} />
          )}
        </Show>
        <Show when={error()}>{(message) => <p class="meme-editor-error">{message()}</p>}</Show>
      </div>
      <div class="meme-editor-actions flex-between">
        <Button disabled={saving()} onClick={props.onClose} variant="secondary">
          Cancel
        </Button>
        <Button disabled={saving() || !decoded()} onClick={() => void save()} variant="primary">
          {saving() ? `Encoding ${Math.round((progress() ?? 0) * 100)}%` : "Add to message"}
        </Button>
      </div>
    </Modal>
  );
}
