import { createEffect } from "solid-js";

export default function CanvasTitle(props: {
  onEnter: () => void;
  onInput: (title: string) => void;
  readonly: boolean;
  ref: (element: HTMLTextAreaElement) => void;
  value: string;
}) {
  let element: HTMLTextAreaElement | undefined;

  function resize() {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  createEffect(
    () => props.value,
    () => void queueMicrotask(resize),
  );

  return (
    <textarea
      aria-label="Canvas title"
      class="canvas-editor-title"
      onInput={({ currentTarget: field }) => {
        // A title is one line, but pasted text can bring breaks with it.
        if (field.value.includes("\n")) {
          const { selectionStart } = field;
          field.value = field.value.replaceAll("\n", " ");
          field.setSelectionRange(selectionStart, selectionStart);
        }
        resize();
        props.onInput(field.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        props.onEnter();
      }}
      placeholder="Untitled"
      readonly={props.readonly}
      ref={(el) => {
        element = el;
        props.ref(el);
      }}
      rows={1}
      value={props.value}
    />
  );
}
