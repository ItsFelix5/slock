import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js";
import type { AvatarUser } from "../avatar/Avatar";
import Icon, { type IconName } from "../media/Icon";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import { useEscapeClose } from "../useEscapeClose";
import "./Combobox.css";
import ComboboxLeading from "./ComboboxLeading";
import { createListboxActiveIndex, listNavigationIndex } from "./listNavigation";
import SuggestionList from "./SuggestionList";

export interface ComboboxOption {
  avatar?: AvatarUser;
  description?: string;
  icon?: IconName;
  id: string;
  label: string;
}

export interface ComboboxProps {
  ariaLabel?: string;
  disabled?: boolean;
  emptyText?: string;
  max?: number;
  multiple?: boolean;
  onChange: (value: ComboboxOption[]) => void;
  placeholder?: string;
  search: (query: string) => ComboboxOption[] | Promise<ComboboxOption[]>;
  value: ComboboxOption[];
}

export default function Combobox(props: ComboboxProps) {
  const listboxId = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<ComboboxOption[]>([]);
  const [width, setWidth] = createSignal(0);
  let root: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  const chosen = () => new Set(props.value.map((option) => option.id));
  const visible = () =>
    props.multiple ? results().filter((option) => !chosen().has(option.id)) : results();
  const full = () => !!props.multiple && !!props.max && props.value.length >= props.max;
  const nav = createListboxActiveIndex(
    () => visible().length,
    listboxId,
    () => panel,
  );

  useEscapeClose(() => setOpen(false), open);
  onCleanup(() => clearTimeout(timer));

  createEffect(() => {
    if (!open()) return;
    const text = query();
    const id = ++requestId;
    clearTimeout(timer);
    const run = () =>
      Promise.resolve(props.search(text))
        .then((found) => id === requestId && setResults(found))
        .catch(() => id === requestId && setResults([]));
    if (text) timer = setTimeout(run, 150);
    else void run();
  });

  const show = () => {
    if (props.disabled) return;
    setWidth(root?.offsetWidth ?? 0);
    setOpen(true);
  };

  const pick = (option: ComboboxOption | undefined) => {
    if (!option || full()) return;
    setQuery("");
    if (props.multiple) props.onChange([...props.value, option]);
    else {
      props.onChange([option]);
      setOpen(false);
    }
  };

  const remove = (id: string) => props.onChange(props.value.filter((option) => option.id !== id));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open()) return show();
      const next = listNavigationIndex(
        event.key === "ArrowDown" ? "down" : "up",
        nav.activeIndex(),
        visible().length,
        { wrap: true },
      );
      if (next !== undefined) nav.setActiveIndex(next);
    } else if (event.key === "Enter" && open()) {
      event.preventDefault();
      const index = nav.activeIndex();
      if (index !== null) pick(visible()[index]);
    } else if (event.key === "Backspace" && !query() && props.multiple && props.value.length) {
      remove(props.value[props.value.length - 1]?.id ?? "");
    }
  };

  const selectedOption = () => (props.multiple ? undefined : props.value[0]);
  const single = () => selectedOption()?.label;

  return (
    <div
      class="combobox flex-align-center"
      classList={{ disabled: props.disabled }}
      onClick={() => {
        input?.focus();
        show();
      }}
      ref={root}
    >
      <Show when={selectedOption()}>{(option) => <ComboboxLeading option={option()} />}</Show>
      <For each={props.multiple ? props.value : []}>
        {(option) => (
          <span class="combobox-chip flex-align-center">
            <ComboboxLeading option={option} />
            {option.label}
            <button
              aria-label={`Remove ${option.label}`}
              class="combobox-chip-remove btn-reset"
              disabled={props.disabled}
              onClick={(event) => {
                event.stopPropagation();
                remove(option.id);
              }}
              type="button"
            >
              ×
            </button>
          </span>
        )}
      </For>
      <input
        aria-activedescendant={open() ? nav.activeOptionId() : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open()}
        aria-label={props.ariaLabel}
        class="combobox-input"
        disabled={props.disabled}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onFocus={show}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          show();
        }}
        onKeyDown={onKeyDown}
        placeholder={single() ?? (props.value.length ? undefined : props.placeholder)}
        ref={input}
        role="combobox"
        value={open() ? query() : (single() ?? "")}
      />
      <Icon class="combobox-caret" name="caret-down" size={14} />
      <FloatingPanel
        anchor={() => root}
        class="combobox-panel surface-popover"
        open={open()}
        panelRef={(element) => {
          panel = element;
        }}
        style={{ width: `${width()}px` }}
      >
        <Show
          fallback={<div class="combobox-empty meta-dim">{props.emptyText ?? "No results"}</div>}
          when={visible().length}
        >
          <SuggestionList
            activeIndex={nav.activeIndex()}
            id={listboxId}
            itemId={nav.optionId}
            items={visible()}
            onHover={nav.setActiveIndex}
            onPick={(index) => pick(visible()[index])}
            renderItem={(option) => (
              <>
                <ComboboxLeading option={option} />
                <span class="suggestion-label">{option.label}</span>
                <Show when={option.description}>
                  <span class="suggestion-desc truncate">{option.description}</span>
                </Show>
              </>
            )}
          />
        </Show>
      </FloatingPanel>
    </div>
  );
}
