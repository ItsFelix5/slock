import { SegmentedControl, Slider } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { type Crop, type Edits, SPEEDS, setCrop, setTrim } from "../lib/edits";

const SIDES: { label: string; side: keyof Crop }[] = [
  { label: "Crop left", side: "left" },
  { label: "Crop right", side: "right" },
  { label: "Crop top", side: "top" },
  { label: "Crop bottom", side: "bottom" },
];

function Row(props: { children: JSX.Element; label: string }) {
  return (
    <div class="editor-row">
      <span class="field-label">{props.label}</span>
      {props.children}
    </div>
  );
}

export default function EditorControls(props: {
  frameCount: number;
  edits: Edits;
  onChange: (next: Edits) => void;
}) {
  const last = () => props.frameCount - 1;
  return (
    <div class="editor-controls flex-col">
      <input
        aria-label="Top text"
        class="text-field"
        onInput={(e) => props.onChange({ ...props.edits, top: e.currentTarget.value })}
        placeholder="Top text"
        type="text"
        value={props.edits.top}
      />
      <input
        aria-label="Bottom text"
        class="text-field"
        onInput={(e) => props.onChange({ ...props.edits, bottom: e.currentTarget.value })}
        placeholder="Bottom text"
        type="text"
        value={props.edits.bottom}
      />
      <Row label="Text size">
        <Slider
          ariaLabel="Text size"
          max={0.25}
          min={0.05}
          onChange={(size) => props.onChange({ ...props.edits, size })}
          value={props.edits.size}
        />
      </Row>
      <For each={SIDES}>
        {({ label, side }) => (
          <Row label={label}>
            <Slider
              ariaLabel={label}
              max={0.9}
              min={0}
              onChange={(value) =>
                props.onChange({ ...props.edits, crop: setCrop(props.edits.crop, side, value) })
              }
              value={props.edits.crop[side]}
            />
          </Row>
        )}
      </For>
      <Show when={props.frameCount > 1}>
        <Row label="Trim start">
          <Slider
            ariaLabel="Trim start"
            max={last()}
            min={0}
            onChange={(value) => props.onChange(setTrim(props.edits, "start", value, last()))}
            step={1}
            value={props.edits.start}
          />
        </Row>
        <Row label="Trim end">
          <Slider
            ariaLabel="Trim end"
            max={last()}
            min={0}
            onChange={(value) => props.onChange(setTrim(props.edits, "end", value, last()))}
            step={1}
            value={props.edits.end}
          />
        </Row>
        <Row label="Speed">
          <SegmentedControl>
            <For each={SPEEDS}>
              {(speed) => (
                <button
                  class={`segmented-control-btn${props.edits.speed === speed ? " active" : ""}`}
                  onClick={() => props.onChange({ ...props.edits, speed })}
                  type="button"
                >
                  {speed}×
                </button>
              )}
            </For>
          </SegmentedControl>
        </Row>
      </Show>
    </div>
  );
}
