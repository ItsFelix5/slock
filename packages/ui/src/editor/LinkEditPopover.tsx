import { createEffect, createSignal } from "solid-js";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import "./LinkEditPopover.css";

export interface LinkEditPopoverProps {
  anchor: () => HTMLElement | undefined;
  onClose: () => void;
  onUpdate: (url: string, text: string) => void;
  open: boolean;
  text: string;
  url: string;
}

export default function LinkEditPopover(props: LinkEditPopoverProps) {
  const [url, setUrl] = createSignal(props.url);
  const [text, setText] = createSignal(props.text);
  let panelRef: HTMLDivElement | undefined;
  let urlInput: HTMLInputElement | undefined;
  let wasOpen = false;

  createEffect(() => {
    if (props.open && !wasOpen) {
      setUrl(props.url);
      setText(props.text);
      queueMicrotask(() => urlInput?.select());
    }
    wasOpen = props.open;
  });

  const commitAndClose = () => {
    props.onUpdate(url(), text());
    props.onClose();
  };

  useClickOutside([props.anchor, () => panelRef], () => {
    if (props.open) commitAndClose();
  });
  useEscapeClose(props.onClose, () => props.open);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitAndClose();
  };

  const handleFocusOut = () => {
    queueMicrotask(() => {
      if (panelRef?.contains(document.activeElement)) return;
      if (props.open) commitAndClose();
    });
  };

  return (
    <FloatingPanel
      anchor={props.anchor}
      class="link-edit-popover"
      onFocusOut={handleFocusOut}
      onScroll={props.onClose}
      open={props.open}
      panelRef={(element) => {
        panelRef = element;
      }}
    >
      <div class="link-edit-form">
        <label class="link-edit-field">
          <span>Text</span>
          <input
            class="input-reset"
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            type="text"
            value={text()}
          />
        </label>
        <label class="link-edit-field">
          <span>Link</span>
          <input
            class="input-reset"
            onInput={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            ref={urlInput}
            type="text"
            value={url()}
          />
        </label>
      </div>
    </FloatingPanel>
  );
}
