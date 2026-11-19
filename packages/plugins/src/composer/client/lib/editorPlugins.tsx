import { getHost } from "@slock/core/solid";
import type Quill from "@slock/ui/editor/quill";
import { createSignal, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { ComposerEditor, ComposerProps } from "../api";

export function createEditorPlugins(getQuill: () => Quill | undefined, props?: ComposerProps) {
  const [popover, setPopover] = createSignal<(close: () => void) => JSX.Element>();
  const editor: ComposerEditor = {
    props,
    quill: getQuill,
    showPopover: (render) => setPopover(() => render),
  };

  return {
    bind(quill: Quill): Array<() => void> {
      return getHost()
        .items("composer.editor")
        .flatMap((bind) => bind(quill, editor) ?? []);
    },
    editor,
    popover: () => (
      <Show when={popover()}>
        {(render) => <div class="composer-popover">{render()(() => setPopover(undefined))}</div>}
      </Show>
    ),
  };
}
