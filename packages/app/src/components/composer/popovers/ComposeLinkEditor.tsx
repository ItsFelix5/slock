import { Button, useClickOutside, useEscapeClose } from "@slock/ui";
import { createSignal } from "solid-js";
import { replaceLinkElement, unlinkElement } from "../lib/linkChip";
import { placeCaretInText } from "../lib/richtext";

export default function ComposeLinkEditor(props: {
  linkEl: HTMLElement;
  url: string;
  currentLabel?: string;
  onClose: () => void;
  onSync: () => void;
}) {
  const [label, setLabel] = createSignal(props.currentLabel ?? "");
  let currentEl = props.linkEl;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let rootRef: HTMLDivElement | undefined;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let inputRef: HTMLInputElement | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(
    () => rootRef,
    () => props.onClose(),
  );

  const save = () => {
    const text = label().trim();
    if (text) {
      currentEl = replaceLinkElement(currentEl, props.url, text);
      props.onSync();
    }
  };

  const unlink = () => {
    const text = unlinkElement(currentEl);
    placeCaretInText(text, text.length);
    props.onSync();
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
      <label class="compose-link-label" for="compose-link-input">
        Text to display
      </label>
      <input
        autofocus
        class="compose-link-input input-reset"
        id="compose-link-input"
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
        placeholder={props.url}
        ref={inputRef}
        type="text"
        value={label()}
      />
      <div class="compose-link-footer">
        <span class="compose-link-url" title={props.url}>
          {props.url}
        </span>
        <Button onClick={unlink} size="sm" type="button" variant="ghost">
          Unlink
        </Button>
      </div>
    </div>
  );
}
