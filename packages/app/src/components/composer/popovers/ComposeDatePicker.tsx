import { formatSlackDateTokens } from "@slock/blockkit";
import { IconButton, useClickOutside, useEscapeClose } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import "./ComposeDatePicker.css";

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dateToTs(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export default function ComposeDatePicker(props: {
  dateOnly?: boolean;
  onSelect: (timestamp: number, format: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = createSignal(props.dateOnly ? startOfToday() : nextHour());
  const [dateFormat, setDateFormat] = createSignal(
    props.dateOnly ? "{date_short_pretty}" : "{date_pretty}",
  );
  const [timeFormat, setTimeFormat] = createSignal(props.dateOnly ? "" : "{time}");
  const [useAgo, setUseAgo] = createSignal(false);
  const format = () => {
    if (useAgo()) return "{ago}";
    return [dateFormat(), timeFormat()].filter(Boolean).join(" at ");
  };

  useEscapeClose(props.onClose);
  useClickOutside(".compose-date-picker", props.onClose);

  const onDateInput = (value: string) => {
    const d = new Date(props.dateOnly ? `${value}T00:00:00` : value);
    if (!Number.isNaN(d.getTime())) setDate(d);
  };

  const selectAgo = () => setUseAgo(true);
  const selectDateFormat = (value: string) => {
    setDateFormat(value);
    setUseAgo(false);
  };
  const selectTimeFormat = (value: string) => {
    setTimeFormat(value);
    setUseAgo(false);
  };

  return (
    <div class="compose-date-picker surface-popover">
      <input
        class="compose-date-input text-field input-reset"
        onInput={(e) => onDateInput(e.currentTarget.value)}
        step="1"
        type={props.dateOnly ? "date" : "datetime-local"}
        value={props.dateOnly ? toLocalInputValue(date()).slice(0, 10) : toLocalInputValue(date())}
      />
      <Show when={!props.dateOnly}>
        <div class="compose-date-section">
          <div class="compose-date-section-heading flex-between">
            <span>Date</span>
            <button
              aria-pressed={useAgo()}
              class="compose-date-relative-btn btn-reset"
              classList={{ active: useAgo() }}
              onClick={selectAgo}
              type="button"
            >
              Relative
            </button>
          </div>
          <div class="compose-date-option-list">
            <button
              class="compose-date-option"
              classList={{ active: !(useAgo() || dateFormat()) }}
              onClick={() => selectDateFormat("")}
              type="button"
            >
              <span>No date</span>
            </button>
            <For
              each={[
                { label: "Abbreviated", normal: "{date_short}", relative: "{date_short_pretty}" },
                { label: "Natural", normal: "{date}", relative: "{date_pretty}" },
                { label: "With weekday", normal: "{date_long}", relative: "{date_long_pretty}" },
              ]}
            >
              {(pair) => (
                <div class="compose-date-option-pair" classList={{ single: !pair.relative }}>
                  <button
                    class="compose-date-option"
                    classList={{ active: !useAgo() && dateFormat() === pair.normal }}
                    onClick={() => selectDateFormat(pair.normal)}
                    type="button"
                  >
                    <span>{formatSlackDateTokens(pair.normal, dateToTs(date()))}</span>
                    <span class="compose-date-option-detail">{pair.label}</span>
                  </button>
                  <Show when={pair.relative}>
                    {(relative) => (
                      <IconButton
                        active={!useAgo() && dateFormat() === relative()}
                        class="compose-date-relative-option"
                        icon="history"
                        iconSize={14}
                        label="Use yesterday/today/tomorrow when applicable"
                        onClick={() => selectDateFormat(relative())}
                      />
                    )}
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="compose-date-section">
          <div class="compose-date-section-heading flex-between">Time</div>
          <div class="compose-date-option-list">
            <button
              class="compose-date-option"
              classList={{ active: !(useAgo() || timeFormat()) }}
              onClick={() => selectTimeFormat("")}
              type="button"
            >
              <span>No time</span>
            </button>
            <For
              each={[
                { format: "{time}", label: "Hours and minutes" },
                { format: "{time_secs}", label: "Including seconds" },
              ]}
            >
              {(option) => (
                <button
                  class="compose-date-option"
                  classList={{ active: !useAgo() && timeFormat() === option.format }}
                  onClick={() => selectTimeFormat(option.format)}
                  type="button"
                >
                  <span>{formatSlackDateTokens(option.format, dateToTs(date()))}</span>
                  <span class="compose-date-option-detail">{option.label}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
      <div class="compose-date-footer flex-between">
        <Show
          fallback={<span class="compose-date-empty">Choose a date, time, or relative time</span>}
          when={format()}
        >
          <span class="compose-date-preview">
            {formatSlackDateTokens(format(), dateToTs(date()))}
          </span>
        </Show>
        <button
          class="compose-date-insert"
          disabled={!format()}
          onClick={() => props.onSelect(dateToTs(date()), format())}
          type="button"
        >
          Insert
        </button>
      </div>
    </div>
  );
}
