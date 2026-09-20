import { createSignal, onCleanup, Show } from "solid-js";
import { comboFromEvent, comboLabel, type ShortcutCombo } from "../useShortcut";
import "./KeybindField.css";

export interface KeybindFieldProps {
  combo: ShortcutCombo | null;
  isCustom: boolean;
  label: string;
  onChange: (combo: ShortcutCombo | null) => void;
  onReset: () => void;
}

export default function KeybindField(props: KeybindFieldProps) {
  const [recording, setRecording] = createSignal(false);
  let cleanup: (() => void) | undefined;

  function stopRecording() {
    cleanup?.();
    cleanup = undefined;
    setRecording(false);
  }

  function startRecording() {
    if (recording()) return stopRecording();
    setRecording(true);
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return stopRecording();
      if (e.key === "Backspace" || e.key === "Delete") {
        props.onChange(null);
        return stopRecording();
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      props.onChange(combo);
      stopRecording();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    cleanup = () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }

  onCleanup(() => cleanup?.());

  return (
    <div class="keybind-field flex-align-center">
      <button
        aria-label={`Change keybind for ${props.label}`}
        class="keybind-field-btn btn-reset"
        classList={{ recording: recording() }}
        onClick={startRecording}
        type="button"
      >
        <Show when={!recording()} fallback="Press a key…">
          <Show when={props.combo} fallback={<span class="text-dim">Not set</span>}>
            {(combo) => <kbd>{comboLabel(combo())}</kbd>}
          </Show>
        </Show>
      </button>
      <Show when={props.isCustom}>
        <button
          aria-label={`Reset ${props.label} to default`}
          class="keybind-field-reset btn-reset"
          onClick={props.onReset}
          type="button"
        >
          Reset
        </button>
      </Show>
    </div>
  );
}
