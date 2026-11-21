import type Quill from "@slock/ui/editor/quill";
import { type Accessor, createEffect } from "solid-js";

export function useQuillEnabled(
  quill: Accessor<Quill | undefined>,
  disabled: Accessor<boolean | undefined>,
) {
  createEffect(
    () => ({ disabled: disabled(), quill: quill() }),
    (state) => void state.quill?.enable(!state.disabled),
  );
}
