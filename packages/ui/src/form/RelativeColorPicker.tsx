import IconButton from "../button/IconButton";
import type { ColorRef } from "../themeDerivations";
import ColorChannelRow from "./ColorChannelRow";
import "./OklchColorPicker.css";

export interface RelativeColorPickerProps {
  label: string;
  onChange: (ref: ColorRef) => void;
  onDecouple: () => void;
  preview: string;
  reference: ColorRef;
}

export default function RelativeColorPicker(props: RelativeColorPickerProps) {
  function update(patch: Partial<ColorRef>) {
    const { source, deltaL, deltaC, alpha } = { ...props.reference, ...patch };
    props.onChange({
      alpha: alpha === 100 ? undefined : alpha,
      deltaC: deltaC || undefined,
      deltaL: deltaL || undefined,
      source,
    });
  }

  return (
    <div aria-label={`${props.label} relative color picker`} class="oklch-picker">
      <div class="oklch-picker-preview" style={{ background: props.preview }} />
      <ColorChannelRow
        digits={1}
        label="Lightness"
        max={50}
        min={-50}
        onInput={(deltaL) => update({ deltaL })}
        step={0.5}
        value={props.reference.deltaL ?? 0}
      />
      <ColorChannelRow
        digits={1}
        label="Chroma"
        max={20}
        min={-20}
        onInput={(deltaC) => update({ deltaC })}
        step={0.1}
        value={props.reference.deltaC ?? 0}
      />
      <ColorChannelRow
        digits={0}
        label="Alpha"
        max={100}
        min={0}
        onInput={(alpha) => update({ alpha })}
        step={1}
        value={props.reference.alpha ?? 100}
      />
      <div class="oklch-picker-footer flex-align-center">
        <output class="oklch-picker-value truncate">Relative to {props.reference.source}</output>
        <IconButton icon="link" label="Decouple" onClick={props.onDecouple} size="sm" tone="dim" />
      </div>
    </div>
  );
}
