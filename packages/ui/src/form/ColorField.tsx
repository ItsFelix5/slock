import { createEffect, createSignal } from "solid-js";
import IconButton from "../button/IconButton";
import Popover from "../overlay/Popover";
import OklchColorPicker from "./OklchColorPicker";
import type { RelativeColor } from "./RelativeChannelRows";
import "./ColorField.css";

export interface ColorFieldProps {
  displayValue?: string;
  isCustom: boolean;
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
        <OklchColorPicker
          label={props.label}
          onChange={commit}
          relative={props.relative}
          value={value()}
        />
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
      <IconButton disabled={!props.isCustom} icon="rotate" onClick={reset} size="md" />
    </div>
  );
}
