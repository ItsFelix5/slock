import { For } from "solid-js";
import "./Slider.css";

export interface SliderProps {
  ariaLabel: string;
  labels?: string[];
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number | "any";
  value: number;
}

export default function Slider(props: SliderProps) {
  const tickSpacing = () =>
    props.labels && props.labels.length > 1
      ? (props.max - props.min) / (props.labels.length - 1)
      : 0;
  return (
    <div class="slider">
      <input
        aria-label={props.ariaLabel}
        class="slider-input"
        max={props.max}
        min={props.min}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        step={props.step ?? "any"}
        type="range"
        value={props.value}
      />
      <div class="slider-ticks">
        <For each={props.labels}>
          {(label, i) => (
            <span
              class="slider-tick"
              classList={{
                active: Math.abs(props.value - (props.min + i() * tickSpacing())) < 0.05,
              }}
              onclick={() => props.onChange(props.min + i() * tickSpacing())}
            >
              {label}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}
