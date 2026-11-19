import { useClickOutside } from "../../hooks/useClickOutside";
import { useCancelShortcut, useEscapeClose } from "../../hooks/useEscapeClose";
import { inside } from "../../hooks/useShortcut";
import type { createMenuRovingFocus } from "./rovingMenuFocus";
import { useMenuShortcuts } from "./rovingMenuFocus";

export default function MenuOpenBehavior(props: {
  focusTrigger: () => void;
  onClose: () => void;
  panel: () => HTMLElement | undefined;
  roving: ReturnType<typeof createMenuRovingFocus>;
  root: () => HTMLElement | undefined;
}) {
  useMenuShortcuts(props.roving, [props.root, props.panel]);
  useCancelShortcut(
    () => {
      props.onClose();
      queueMicrotask(props.focusTrigger);
    },
    { target: inside(props.panel) },
  );
  useClickOutside([props.root, props.panel], props.onClose);
  useEscapeClose(props.onClose);
  return null;
}
