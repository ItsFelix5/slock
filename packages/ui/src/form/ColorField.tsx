import { createEffect, createSignal } from "solid-js";
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
          <input
            class="color-field-native"
            onInput={(e) => commit(e.currentTarget.value)}
            title="Pick a color"
            type="color"
            value={props.value}
          />
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
      <button
        class="color-field-reset"
        onClick={props.onReset}
        title="Reset to default"
        type="button"
      >
        ↺
      </button>
    </div>
  );
}
