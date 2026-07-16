import { createEffect, createSignal } from "solid-js";
import Tooltip from "../overlay/Tooltip";
import "./ColorField.css";

const HEX_RE = /^#[0-9a-f]{6}$/i;

export interface ColorFieldProps {
  label: string;
  onChange: (value: string) => void;
  onReset: () => void;
  value: string;
}

export default function ColorField(props: ColorFieldProps) {
  const [draft, setDraft] = createSignal(props.value);

  createEffect(() => setDraft(props.value));

  function commit(next: string) {
    if (!(next && CSS.supports("color", next))) return;
    props.onChange(next);
  }

  return (
    <div class="color-field">
      <div class="color-field-swatch" style={{ "background-color": props.value }}>
        {HEX_RE.test(props.value) && (
          <Tooltip content="Pick a color">
            <input
              aria-label="Pick a color"
              class="color-field-native"
              onInput={(e) => commit(e.currentTarget.value)}
              type="color"
              value={props.value}
            />
          </Tooltip>
        )}
      </div>
      <div class="color-field-name">{props.label}</div>
      <input
        class="color-field-text"
        onChange={(e) => commit(e.currentTarget.value.trim())}
        onInput={(e) => setDraft(e.currentTarget.value)}
        spellcheck={false}
        type="text"
        value={draft()}
      />
      <Tooltip content="Reset to default">
        <button
          aria-label="Reset to default"
          class="color-field-reset"
          onClick={props.onReset}
          type="button"
        >
          ↺
        </button>
      </Tooltip>
    </div>
  );
}
