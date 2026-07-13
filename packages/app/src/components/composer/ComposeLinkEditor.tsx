import { Button, useClickOutside, useEscapeClose } from "@slock/ui";
import { createSignal } from "solid-js";
import { replaceLinkElement, unlinkElement } from "./lib/linkChip";
import { placeCaretInText } from "./lib/richtext";

export default function ComposeLinkEditor(props: {
  linkEl: HTMLElement;
  url: string;
  currentLabel?: string;
  onClose: () => void;
}) {
  const [label, setLabel] = createSignal(props.currentLabel ?? "");
  let rootRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(
    () => rootRef,
    () => props.onClose(),
  );

  const save = () => {
    const text = label().trim();
    if (text) {
      replaceLinkElement(props.linkEl, props.url, text);
    }
  };

  const unlink = () => {
    const text = unlinkElement(props.linkEl);
    placeCaretInText(text, text.length);
    props.onClose();
  };

  return (
    <div ref={rootRef} class="menu-panel compose-link-editor" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        class="compose-link-input"
        placeholder="Display text (optional)"
        value={label()}
        onInput={(e) => {
          setLabel(e.currentTarget.value);
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onClose();
          }
        }}
        autofocus
      />
      <div class="compose-link-buttons">
        <Button type="button" variant="secondary" size="sm" onClick={unlink}>
          Unlink
        </Button>
      </div>
    </div>
  );
}
