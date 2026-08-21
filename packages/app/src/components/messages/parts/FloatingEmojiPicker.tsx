import { FloatingPanel, useClickOutside } from "@slock/ui";
import EmojiPicker from "../../composer/popovers/EmojiPicker";

export default function FloatingEmojiPicker(props: {
  anchor: () => HTMLElement | undefined;
  onClose: () => void;
  onSelect: (name: string) => void;
  open: boolean;
  existingReactions?: { name: string; mine: boolean }[];
}) {
  let panelRef: HTMLDivElement | undefined;

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
      <EmojiPicker
        existingReactions={props.existingReactions}
        onClose={props.onClose}
        onSelect={props.onSelect}
      />
    </FloatingPanel>
  );
}
