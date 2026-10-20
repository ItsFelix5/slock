import { getHost } from "@slock/core/solid";
import type Quill from "@slock/ui/editor/quill";
import { createSignal, type JSX, onCleanup, Show } from "solid-js";
import type { ComposerEditor } from "../api";

export function createEditorPlugins(getQuill: () => Quill | undefined) {
  const [popover, setPopover] = createSignal<(close: () => void) => JSX.Element>();
  const editor: ComposerEditor = {
    quill: getQuill,
    showPopover: (render) => setPopover(() => render),
  };

  return {
    bind(quill: Quill) {
      for (const bind of getHost().items("composer.editor")) {
        const cleanup = bind(quill, editor);
        if (cleanup) onCleanup(cleanup);
      }
    },
    editor,
    popover: () => (
      <Show when={popover()}>
        {(render) => <div class="composer-popover">{render()(() => setPopover(undefined))}</div>}
      </Show>
    ),
  };
}
