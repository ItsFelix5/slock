import { FloatingPanel, useClickOutside } from "@slock/ui";
import EmojiPicker from "../../composer/popovers/EmojiPicker";

export default function FloatingEmojiPicker(props: {
  anchor: () => HTMLElement | undefined;
  onClose: () => void;
  onSelect: (name: string) => void;
  open: boolean;
}) {
  let panelRef: HTMLDivElement | undefined;

  // The trigger button must count as "inside" here, otherwise its own click
  // races this mousedown listener: mousedown closes the picker first, then
  // the trigger's click handler re-opens it, so the popover never closes.
  useClickOutside([props.anchor, () => panelRef], () => {
    if (props.open) props.onClose();
  });

  return (
    <FloatingPanel
      align="end"
      anchor={props.anchor}
      class="reaction-picker-full"
      gap={4}
      onScroll={props.onClose}
      open={props.open}
      panelRef={(element) => {
        panelRef = element;
      }}
    >
      <EmojiPicker onClose={props.onClose} onSelect={props.onSelect} />
    </FloatingPanel>
  );
}
