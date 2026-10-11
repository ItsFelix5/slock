export interface ColorChannelRowProps {
  digits: number;
  label: string;
  max: number;
  min: number;
  onInput: (value: number) => void;
  step: number;
  track?: string;
  value: number;
}

export default function ColorChannelRow(props: ColorChannelRowProps) {
  return (
    <label class="oklch-picker-channel">
      <span>{props.label}</span>
      <input
        aria-label={props.label}
        max={props.max}
        min={props.min}
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        step={props.step}
        style={{ "--channel-track": props.track }}
        type="range"
        value={props.value}
      />
      <input
        aria-label={`${props.label} value`}
        class="oklch-picker-number text-field"
        max={props.max}
        min={props.min}
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        step={props.step}
        type="number"
        value={props.value.toFixed(props.digits)}
      />
    </label>
  );
}
