import type { ColorRef } from "../themeDerivations";
import ColorChannelRow from "./ColorChannelRow";

export interface RelativeColor {
  onChange: (ref: ColorRef) => void;
  onDecouple: () => void;
  reference: ColorRef;
}

export type RelativeChannelRowsProps = Pick<RelativeColor, "onChange" | "reference">;

export default function RelativeChannelRows(props: RelativeChannelRowsProps) {
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
    <>
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
    </>
  );
}
