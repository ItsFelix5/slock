import type { Setup } from "@slock/core";
import type { SlackFile } from "@slock/types";
import { createSignal, lazy, Show } from "solid-js";

const FileDetailModal = lazy(() => import("./views/file-detail/FileDetailModal"));

const setup: Setup = (ctx) => {
  const [file, setFile] = createSignal<SlackFile>();
  ctx.provide("files", { open: setFile });
  ctx.add("shell.overlay", () => (
    <Show when={file()}>
      {(current) => <FileDetailModal file={current()} onClose={() => setFile(undefined)} />}
    </Show>
  ));
};

export default setup;
