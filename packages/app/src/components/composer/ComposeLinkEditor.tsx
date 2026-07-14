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
    <div
      class="menu-panel compose-link-editor"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      ref={rootRef}
      role="dialog"
      tabIndex={-1}
    >
      <input
        autofocus
        class="compose-link-input input-reset"
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
        placeholder="Display text (optional)"
        ref={inputRef}
        type="text"
        value={label()}
      />
      <div class="compose-link-buttons">
        <Button onClick={unlink} size="sm" type="button" variant="secondary">
          Unlink
        </Button>
      </div>
    </div>
  );
}
