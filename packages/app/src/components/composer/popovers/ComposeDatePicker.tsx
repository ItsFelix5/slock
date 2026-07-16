import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, formatSlackDateTokens } from "@slock/blockkit";
import { Button, Icon, useClickOutside, useEscapeClose } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";

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
  { date: nextHour, label: "In 1 hour" },
  { date: tomorrowAt9, label: "Tomorrow at 9 AM" },
  { date: nextMondayAt9, label: "Next Monday at 9 AM" },
];

// Picks a moment in time for a <!date^…> token, then a display format for
// it — the one composer "block" that can't be typed inline, since it needs
// an actual calendar/time input plus Slack's own date-format picker step.
export default function ComposeDatePicker(props: {
  onSelect: (timestamp: number, format: string) => void;
  onClose: () => void;
}) {
  let inputRef: HTMLInputElement | undefined;
  const [pickedDate, setPickedDate] = createSignal<Date | null>(null);

  useEscapeClose(() => (pickedDate() ? setPickedDate(null) : props.onClose()));
  useClickOutside(".compose-date-picker", props.onClose);

  const insertCustom = () => {
    if (!inputRef?.value) return;
    const d = new Date(inputRef.value);
    if (!Number.isNaN(d.getTime())) setPickedDate(d);
  };

  return (
    <div class="compose-date-picker">
      <Show
        fallback={
          <>
            <For each={PRESETS}>
              {(preset) => (
                <button
                  class="compose-date-row menu-item"
                  onClick={() => setPickedDate(preset.date())}
                  type="button"
                >
                  <span>{preset.label}</span>
                  <span class="compose-date-preview">
                    {formatSlackDateTokens(DEFAULT_DATE_FORMAT, dateToTs(preset.date()))}
                  </span>
                </button>
              )}
            </For>
            <div class="compose-date-custom">
              <input
                class="compose-date-input input-reset"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertCustom();
                  }
                }}
                ref={inputRef}
                type="datetime-local"
                value={toLocalInputValue(nextHour())}
              />
              <Button onClick={insertCustom} size="sm" type="button" variant="primary">
                Next
              </Button>
            </div>
          </>
        }
        when={pickedDate()}
      >
        {(date) => (
          <>
            <button
              class="compose-date-back menu-item btn-reset flex-align-center"
              onClick={() => setPickedDate(null)}
              type="button"
            >
              <Icon name="arrow-left" size={14} />
              Choose a different time
            </button>
            <For each={DATE_FORMAT_OPTIONS}>
              {(option) => (
                <button
                  class="compose-date-row menu-item"
                  onClick={() => props.onSelect(dateToTs(date()), option.format)}
                  type="button"
                >
                  <span>{option.label}</span>
                  <span class="compose-date-preview">
                    {formatSlackDateTokens(option.format, dateToTs(date()))}
                  </span>
                </button>
              )}
            </For>
          </>
        )}
      </Show>
    </div>
  );
}

function dateToTs(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}
