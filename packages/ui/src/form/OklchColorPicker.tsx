import { createEffect, createSignal, Show } from "solid-js";
import IconButton from "../button/IconButton";
import ColorChannelRow from "./ColorChannelRow";
import { cssColorToOklch, formatOklch, type OklchColor } from "./oklchColor";
import RelativeChannelRows, { type RelativeColor } from "./RelativeChannelRows";
import "./OklchColorPicker.css";

export interface OklchColorPickerProps {
  label: string;
  onChange: (value: string) => void;
  relative?: RelativeColor;
  value: string;
}

type ColorChannel = keyof OklchColor;

export default function OklchColorPicker(props: OklchColorPickerProps) {
  const [color, setColor] = createSignal(cssColorToOklch(props.value));

  createEffect(() => setColor(cssColorToOklch(props.value)));

  function update(channel: ColorChannel, value: number) {
    const next = { ...color(), [channel]: value };
    setColor(next);
    props.onChange(formatOklch(next));
  }

  const hueGradient = () => {
    const { chroma, lightness } = color();
    return `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
      .map((hue) => `oklch(${lightness} ${Math.max(chroma, 0.08)} ${hue})`)
      .join(", ")})`;
  };
  const lightnessGradient = () => {
    const { chroma, hue } = color();
    return `linear-gradient(to right, oklch(0.08 ${chroma} ${hue}), oklch(0.98 ${chroma} ${hue}))`;
  };
  const chromaGradient = () => {
    const { hue, lightness } = color();
    return `linear-gradient(to right, oklch(${lightness} 0 ${hue}), oklch(${lightness} 0.4 ${hue}))`;
  };
  const alphaGradient = () => {
    const { chroma, hue, lightness } = color();
    return `linear-gradient(to right, oklch(${lightness} ${chroma} ${hue} / 0), oklch(${lightness} ${chroma} ${hue}))`;
  };

  return (
    <div aria-label={`${props.label} color picker`} class="oklch-picker">
      <Show when={props.relative}>
        {(relative) => (
          <div class="oklch-picker-footer flex-align-center">
            <output class="oklch-picker-value truncate">
              Relative to {relative().reference.source}
            </output>
            <IconButton
              icon="link"
              label="Decouple"
              onClick={relative().onDecouple}
              size="sm"
              tone="dim"
            />
          </div>
        )}
      </Show>
      <div class="oklch-picker-preview" style={{ background: props.value }} />
      <Show
        fallback={
          <>
            <ColorChannelRow
              digits={3}
              label="Lightness"
              max={1}
              min={0}
              onInput={(value) => update("lightness", value)}
              step={0.001}
              track={lightnessGradient()}
              value={color().lightness}
            />
            <ColorChannelRow
              digits={3}
              label="Chroma"
              max={0.4}
              min={0}
              onInput={(value) => update("chroma", value)}
              step={0.001}
              track={chromaGradient()}
              value={color().chroma}
            />
            <ColorChannelRow
              digits={1}
              label="Hue"
              max={360}
              min={0}
              onInput={(value) => update("hue", value)}
              step={0.1}
              track={hueGradient()}
              value={color().hue}
            />
            <ColorChannelRow
              digits={3}
              label="Alpha"
              max={1}
              min={0}
              onInput={(value) => update("alpha", value)}
              step={0.01}
              track={alphaGradient()}
              value={color().alpha}
            />
          </>
        }
        when={props.relative}
      >
        {(relative) => (
          <RelativeChannelRows onChange={relative().onChange} reference={relative().reference} />
        )}
      </Show>
      <output class="oklch-picker-value truncate">{formatOklch(color())}</output>
    </div>
  );
}
