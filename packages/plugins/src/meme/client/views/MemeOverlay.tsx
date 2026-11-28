import { lazyChunk, service } from "@slock/core/solid";
import { Show } from "solid-js";

const MemeEditor = lazyChunk(() => import("./MemeEditor"));
const meme = service("meme");

export default function MemeOverlay() {
  return (
    <Show keyed when={meme.target()}>
      {(target) => <MemeEditor onClose={meme.close} target={target} />}
    </Show>
  );
}
