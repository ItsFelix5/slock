import { createSignal, onCleanup } from "solid-js";
import { comboFromEvent, type ShortcutCombo } from "../useShortcut";

export function useKeybindRecorder(onChange: (combo: ShortcutCombo | null) => void) {
  const [recording, setRecording] = createSignal(false);
  let cleanup: (() => void) | undefined;

  function stop() {
    cleanup?.();
    cleanup = undefined;
    setRecording(false);
  }

  function start() {
    if (recording()) return stop();
    setRecording(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") return stop();
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return stop();
      if (e.key === "Backspace" || e.key === "Delete") {
        onChange(null);
        return stop();
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      onChange(combo);
      stop();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    cleanup = () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }

  onCleanup(() => cleanup?.());
  return { recording, start };
}
