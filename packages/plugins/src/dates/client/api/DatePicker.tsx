import { formatSlackDateTokens } from "@slock/blockkit";
import {
  ariaBoolean,
  IconButton,
  useClickOutside,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onSettled, Show } from "solid-js";
import {
  DATE_PAIRS,
  dateToTs,
  joinFormat,
  nextHour,
  parseFormat,
  startOfToday,
  TIME_OPTIONS,
  toLocalInputValue,
} from "./dateFormats";
import "./DatePicker.css";

function FormatOption(props: {
  active: boolean;
  detail: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      class={["compose-date-option", { active: props.active }]}
      onClick={props.onSelect}
      type="button"
    >
      <span>{props.label}</span>
      <Show when={props.detail}>
        <span class="compose-date-option-detail">{props.detail}</span>
      </Show>
    </button>
  );
}

export default function DatePicker(props: {
  dateOnly?: boolean;
  initial?: { ts: number; format: string };
  onSelect: (timestamp: number, format: string) => void;
  onClose: () => void;
}) {
  const initial = createMemo(() => props.initial && parseFormat(props.initial.format));
  const [date, setDate] = createSignal(() => {
    if (props.initial) return new Date(props.initial.ts * 1000);
    return props.dateOnly ? startOfToday() : nextHour();
  });
  const [dateFormat, setDateFormat] = createSignal(
    () => initial()?.date ?? (props.dateOnly ? "{date_short_pretty}" : "{date_pretty}"),
  );
  const [timeFormat, setTimeFormat] = createSignal(
    () => initial()?.time ?? (props.dateOnly ? "" : "{time}"),
  );
  const [useAgo, setUseAgo] = createSignal(() => initial()?.ago ?? false);
  const format = () => joinFormat(useAgo(), dateFormat(), timeFormat());
  const preview = (tokens: string) => formatSlackDateTokens(tokens, dateToTs(date()));

  createEffect(
    () => [date(), format()] as const,
    ([d, f]) => {
      if (props.initial && f) props.onSelect(dateToTs(d), f);
    },
    { defer: true },
  );

  useEscapeClose(props.onClose);
  useClickOutside(".compose-date-picker", props.onClose);

  const onDateInput = (value: string) => {
    const d = new Date(props.dateOnly ? `${value}T00:00:00` : value);
    if (!Number.isNaN(d.getTime())) setDate(d);
  };

  let dateInput: HTMLInputElement | undefined;
  onSettled(() => {
    const timer = setTimeout(() => dateInput?.focus());
    return () => clearTimeout(timer);
  });

  const confirm = () => {
    if (!props.initial && format()) props.onSelect(dateToTs(date()), format());
  };

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
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          confirm();
        }}
        ref={dateInput}
        step="1"
        type={props.dateOnly ? "date" : "datetime-local"}
        value={props.dateOnly ? toLocalInputValue(date()).slice(0, 10) : toLocalInputValue(date())}
      />
      <Show when={!props.dateOnly}>
        <div class="compose-date-section">
          <div class="compose-date-section-heading flex-between">
            <span>Date</span>
            <button
              aria-pressed={ariaBoolean(useAgo())}
              class={["compose-date-relative-btn", "btn-reset", { active: useAgo() }]}
              onClick={() => setUseAgo(true)}
              type="button"
            >
              Relative
            </button>
          </div>
          <div class="compose-date-option-list">
            <FormatOption
              active={!(useAgo() || dateFormat())}
              detail=""
              label="No date"
              onSelect={() => selectDateFormat("")}
            />
            <For each={DATE_PAIRS}>
              {(pair) => (
                <div class="compose-date-option-pair">
                  <FormatOption
                    active={!useAgo() && dateFormat() === pair.normal}
                    detail={pair.label}
                    label={preview(pair.normal)}
                    onSelect={() => selectDateFormat(pair.normal)}
                  />
                  <IconButton
                    active={!useAgo() && dateFormat() === pair.relative}
                    class="compose-date-relative-option"
                    icon="history"
                    iconSize={14}
                    label="Use yesterday/today/tomorrow when applicable"
                    onClick={() => selectDateFormat(pair.relative)}
                  />
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="compose-date-section">
          <div class="compose-date-section-heading flex-between">Time</div>
          <div class="compose-date-option-list">
            <FormatOption
              active={!(useAgo() || timeFormat())}
              detail=""
              label="No time"
              onSelect={() => selectTimeFormat("")}
            />
            <For each={TIME_OPTIONS}>
              {(option) => (
                <FormatOption
                  active={!useAgo() && timeFormat() === option.format}
                  detail={option.label}
                  label={preview(option.format)}
                  onSelect={() => selectTimeFormat(option.format)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={!props.initial}>
        <div class="compose-date-footer flex-between">
          <Show
            fallback={
              <span class="compose-date-empty meta-dim">Choose a date, time, or relative time</span>
            }
            when={format()}
          >
            <span class="compose-date-preview">{preview(format())}</span>
          </Show>
          <button class="compose-date-insert" disabled={!format()} onClick={confirm} type="button">
            Insert
          </button>
        </div>
      </Show>
    </div>
  );
}
