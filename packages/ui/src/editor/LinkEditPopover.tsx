import { createEffect, createSignal } from "solid-js";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import { useEditShortcuts } from "../useNavShortcuts";
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

  useEditShortcuts({
    commit: commitAndClose,
    enabled: () => props.open,
    root: () => panelRef,
  });

  const handleFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || panelRef?.contains(next)) return;
    if (props.open) commitAndClose();
  };

  return (
    <FloatingPanel
      anchor={props.anchor}
      class="link-edit-popover surface-popover"
      onFocusOut={handleFocusOut}
      onScroll={props.onClose}
      open={props.open}
      panelRef={(element) => {
        panelRef = element;
      }}
    >
      <div class="link-edit-form flex-col gap-sm">
        <label class="link-edit-field flex-col gap-xs">
          <span>Text</span>
          <input
            class="text-field"
            onInput={(event) => setText(event.currentTarget.value)}
            type="text"
            value={text()}
          />
        </label>
        <label class="link-edit-field flex-col gap-xs">
          <span>Link</span>
          <input
            class="text-field"
            onInput={(event) => setUrl(event.currentTarget.value)}
            ref={urlInput}
            type="text"
            value={url()}
          />
        </label>
      </div>
    </FloatingPanel>
  );
}
