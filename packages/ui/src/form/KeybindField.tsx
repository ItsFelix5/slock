import { For, Show } from "solid-js";
import { comboParts, type ShortcutCombo } from "../useShortcut";
import { useKeybindRecorder } from "./keybindRecorder";
import "./KeybindField.css";

export interface KeybindFieldProps {
  combo: ShortcutCombo | null;
  isCustom: boolean;
  label: string;
  onChange: (combo: ShortcutCombo | null) => void;
  onReset: () => void;
}

function Keycaps(props: { keys: readonly string[] }) {
  return (
    <span class="keycaps">
      <For each={props.keys}>{(key) => <kbd class="keycap">{key}</kbd>}</For>
    </span>
  );
}

export default function KeybindField(props: KeybindFieldProps) {
  const { recording, start } = useKeybindRecorder(props.onChange);

  return (
    <div class="keybind-field flex-align-center">
      <button
        aria-label={`Change keybind for ${props.label}`}
        class="keybind-field-btn btn-reset"
        classList={{ recording: recording() }}
        data-nav-row
        onClick={start}
        type="button"
      >
        <Show when={!recording()} fallback="Press keys…">
          <Show when={props.combo} fallback={<span class="text-dim">Not set</span>}>
            {(combo) => <Keycaps keys={comboParts(combo())} />}
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
