import { FloatingPanel } from "@slock/ui";
import EmojiPicker from "../../composer/popovers/EmojiPicker";

export default function FloatingEmojiPicker(props: {
  anchor: () => HTMLElement | undefined;
  onClose: () => void;
  onSelect: (name: string) => void;
  open: boolean;
}) {
  return (
    <FloatingPanel
      align="end"
      anchor={props.anchor}
      class="reaction-picker-full"
      gap={4}
      open={props.open}
    >
      <EmojiPicker onClose={props.onClose} onSelect={props.onSelect} />
    </FloatingPanel>
  );
}
