import {
  DATE_FORMAT_OPTION_PAIRS,
  DATE_FORMAT_OPTIONS,
  formatSlackDateTokens,
  TIME_FORMAT_OPTIONS,
} from "@slock/blockkit";
import { Icon, Tooltip, useClickOutside, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./ComposeDatePicker.css";

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
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
  onSelect: (timestamp: number, format: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = createSignal(nextHour());
  const [dateFormat, setDateFormat] = createSignal(DATE_FORMAT_OPTIONS[5].format);
  const [timeFormat, setTimeFormat] = createSignal(TIME_FORMAT_OPTIONS[0].format);
  const [useAgo, setUseAgo] = createSignal(false);
  const format = createMemo(() => {
    if (useAgo()) return "{ago}";
    return [dateFormat(), timeFormat()].filter(Boolean).join(" at ");
  });

  useEscapeClose(props.onClose);
  useClickOutside(".compose-date-picker", props.onClose);

  const onDateInput = (value: string) => {
    const d = new Date(value);
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
    <div class="compose-date-picker">
      <input
        aria-label="Date and time"
        class="compose-date-input input-reset"
        onInput={(e) => onDateInput(e.currentTarget.value)}
        step="1"
        type="datetime-local"
        value={toLocalInputValue(date())}
      />
      <div class="compose-date-section">
        <div class="compose-date-section-heading">
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
          <For each={DATE_FORMAT_OPTION_PAIRS}>
            {(pair) => (
              <div class="compose-date-option-pair" classList={{ single: !pair.relative }}>
                <button
                  class="compose-date-option"
                  classList={{ active: !useAgo() && dateFormat() === pair.normal.format }}
                  onClick={() => selectDateFormat(pair.normal.format)}
                  type="button"
                >
                  <span>{formatSlackDateTokens(pair.normal.format, dateToTs(date()))}</span>
                  <span class="compose-date-option-detail">{pair.normal.label}</span>
                </button>
                <Show when={pair.relative}>
                  {(relative) => (
                    <Tooltip content={`Use ${relative().label.toLowerCase()} date`}>
                      <button
                        aria-label={`Use ${relative().label.toLowerCase()} date`}
                        class="compose-date-relative-option btn-reset"
                        classList={{ active: !useAgo() && dateFormat() === relative().format }}
                        onClick={() => selectDateFormat(relative().format)}
                        type="button"
                      >
                        <Icon name="history" size={14} />
                      </button>
                    </Tooltip>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
      <div class="compose-date-section">
        <div class="compose-date-section-heading">Time</div>
        <div class="compose-date-option-list">
          <button
            class="compose-date-option"
            classList={{ active: !(useAgo() || timeFormat()) }}
            onClick={() => selectTimeFormat("")}
            type="button"
          >
            <span>No time</span>
          </button>
          <For each={TIME_FORMAT_OPTIONS}>
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
      <div class="compose-date-footer">
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
