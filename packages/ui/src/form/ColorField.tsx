import { createEffect, createSignal } from "solid-js";
import Popover from "../overlay/Popover";
import Tooltip from "../overlay/Tooltip";
import OklchColorPicker from "./OklchColorPicker";
import "./ColorField.css";

export interface ColorFieldProps {
  label: string;
  onChange: (value: string) => void;
  onReset: () => void;
  value: string;
}

export default function ColorField(props: ColorFieldProps) {
  const [value, setValue] = createSignal(props.value);
  const [draft, setDraft] = createSignal(value());
  const [pickerOpen, setPickerOpen] = createSignal(false);

  createEffect(() => {
    setValue(props.value);
    setDraft(props.value);
  });

  function commit(next: string) {
    if (!(next && CSS.supports("color", next))) return;
    props.onChange(next);
  }

  function reset() {
    props.onReset();
    setValue(props.value);
  }

  return (
    <div class="color-field">
      <Popover
        onClose={() => setPickerOpen(false)}
        open={pickerOpen()}
        panelClass="color-field-picker-popover"
        trigger={
          <button
            aria-expanded={pickerOpen()}
            aria-haspopup="dialog"
            aria-label={`Pick ${props.label.toLowerCase()}`}
            class="color-field-swatch"
            onClick={() => setPickerOpen((open) => !open)}
            style={{ "background-color": value() }}
            type="button"
          />
        }
      >
        <OklchColorPicker label={props.label} onChange={commit} value={value()} />
      </Popover>
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
          onClick={reset}
          type="button"
        >
          ↺
        </button>
      </Tooltip>
    </div>
  );
}
