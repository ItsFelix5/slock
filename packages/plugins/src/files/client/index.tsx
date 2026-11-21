import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import type { SlackFile } from "@slock/types";
import { createSignal, Show } from "solid-js";

const FileDetailModal = lazyChunk(() => import("./views/file-detail/FileDetailModal"));

const setup: Setup = (ctx) => {
  const [file, setFile] = createSignal<SlackFile>();
  ctx.provide("files", { open: (opened: SlackFile) => setFile(opened) });
  ctx.add("shell.overlay", () => (
    <Show when={file()}>
      {(current) => <FileDetailModal file={current()} onClose={() => setFile(undefined)} />}
    </Show>
  ));
};

export default setup;
