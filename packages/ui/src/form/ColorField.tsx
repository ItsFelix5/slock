import { createEffect, createSignal, Show } from "solid-js";
import Popover from "../overlay/Popover";
import Tooltip from "../overlay/Tooltip";
import type { ColorRef } from "../themeDerivations";
import OklchColorPicker from "./OklchColorPicker";
import RelativeColorPicker from "./RelativeColorPicker";
import "./ColorField.css";

export interface RelativeColor {
  onChange: (ref: ColorRef) => void;
  onDecouple: () => void;
  reference: ColorRef;
}

export interface ColorFieldProps {
  displayValue?: string;
  label: string;
  onChange: (value: string) => void;
  onReset: () => void;
  relative?: RelativeColor;
  value: string;
}

export default function ColorField(props: ColorFieldProps) {
  const [value, setValue] = createSignal(props.value);
  const [draft, setDraft] = createSignal(props.displayValue ?? props.value);
  const [pickerOpen, setPickerOpen] = createSignal(false);

  createEffect(() => {
    setValue(props.value);
    setDraft(props.displayValue ?? props.value);
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
    <div class="color-field flex-align-center">
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
        <Show
          fallback={<OklchColorPicker label={props.label} onChange={commit} value={value()} />}
          when={props.relative}
        >
          {(relative) => (
            <RelativeColorPicker
              label={props.label}
              onChange={relative().onChange}
              onDecouple={relative().onDecouple}
              preview={value()}
              reference={relative().reference}
            />
          )}
        </Show>
      </Popover>
      <div class="color-field-name truncate" title={props.label}>
        {props.label}
      </div>
      <input
        class="color-field-text text-field"
        onChange={(e) => commit(e.currentTarget.value.trim())}
        onInput={(e) => setDraft(e.currentTarget.value)}
        spellcheck={false}
        type="text"
        value={draft()}
      />
      <Tooltip content="Reset to default">
        <button
          aria-label="Reset to default"
          class="color-field-reset hover-hl"
          onClick={reset}
          type="button"
        >
          ↺
        </button>
      </Tooltip>
    </div>
  );
}
