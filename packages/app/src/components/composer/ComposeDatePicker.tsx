import { formatSlackDate } from "@slock/blockkit";
import { Button, useClickOutside, useEscapeClose } from "@slock/ui";
import { For } from "solid-js";

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextMondayAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return d;
}

// datetime-local wants a local-timezone "YYYY-MM-DDTHH:MM" string; Date's own
// toISOString is UTC, so build it by hand.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PRESETS: { label: string; date: () => Date }[] = [
  { label: "In 1 hour", date: nextHour },
  { label: "Tomorrow at 9 AM", date: tomorrowAt9 },
  { label: "Next Monday at 9 AM", date: nextMondayAt9 },
];

// Picks a moment in time for a <!date^…> token — the one composer "block"
// that can't be typed inline, since it needs an actual calendar/time input.
export default function ComposeDatePicker(props: {
  onSelect: (timestamp: number) => void;
  onClose: () => void;
}) {
  let inputRef: HTMLInputElement | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(".compose-date-picker", props.onClose);

  const pick = (d: Date) => props.onSelect(Math.floor(d.getTime() / 1000));

  const insertCustom = () => {
    if (!inputRef?.value) return;
    const d = new Date(inputRef.value);
    if (!Number.isNaN(d.getTime())) pick(d);
  };

  return (
    <div class="compose-date-picker">
      <For each={PRESETS}>
        {(preset) => (
          <button type="button" class="compose-date-row" onClick={() => pick(preset.date())}>
            <span>{preset.label}</span>
            <span class="compose-date-preview">
              {formatSlackDate(Math.floor(preset.date().getTime() / 1000))}
            </span>
          </button>
        )}
      </For>
      <div class="compose-date-custom">
        <input
          ref={inputRef}
          class="compose-date-input"
          type="datetime-local"
          value={toLocalInputValue(nextHour())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insertCustom();
            }
          }}
        />
        <Button type="button" variant="primary" size="sm" onClick={insertCustom}>
          Insert
        </Button>
      </div>
    </div>
  );
}
