import { createEffect, createSignal } from "solid-js";
import "./ColorField.css";

const HEX_RE = /^#[0-9a-f]{6}$/i;

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

export default function ColorField(props: ColorFieldProps) {
  const [draft, setDraft] = createSignal(props.value);

  createEffect(() => setDraft(props.value));

  function commit(next: string) {
    if (!next || !CSS.supports("color", next)) return;
    props.onChange(next);
  }

  return (
    <div class="color-field">
      <div class="color-field-swatch" style={{ "background-color": props.value }}>
        {HEX_RE.test(props.value) && (
          <input
            type="color"
            class="color-field-native"
            value={props.value}
            onInput={(e) => commit(e.currentTarget.value)}
            title="Pick a color"
          />
        )}
      </div>
      <div class="color-field-name">{props.label}</div>
      <input
        type="text"
        class="color-field-text"
        value={draft()}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => commit(e.currentTarget.value.trim())}
        spellcheck={false}
      />
      <button
        type="button"
        class="color-field-reset"
        onClick={props.onReset}
        title="Reset to default"
      >
        ↺
      </button>
    </div>
  );
}
