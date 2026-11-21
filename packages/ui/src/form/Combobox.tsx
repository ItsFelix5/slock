import { createSignal, createUniqueId, For, Show } from "solid-js";
import { ariaBoolean } from "../ariaBoolean";
import type { AvatarUser } from "../avatar/Avatar";
import { useEscapeClose } from "../hooks/useEscapeClose";
import Icon, { type IconName } from "../media/Icon";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import "./Combobox.css";
import ComboboxLeading from "./ComboboxLeading";
import { createOptionSearch } from "./createOptionSearch";
import { createListboxActiveIndex, listNavigationIndex } from "./listNavigation";
import SuggestionList from "./SuggestionList";

export interface ComboboxOption<Id extends string = string> {
  avatar?: AvatarUser;
  description?: string;
  icon?: IconName;
  id: Id;
  label: string;
}

export interface ComboboxProps<Id extends string = string> {
  ariaLabel?: string;
  disabled?: boolean;
  emptyText?: string;
  max?: number;
  multiple?: boolean;
  onChange: (value: ComboboxOption<Id>[]) => void;
  placeholder?: string;
  search: (query: string) => ComboboxOption<Id>[] | Promise<ComboboxOption<Id>[]>;
  value: ComboboxOption<Id>[];
}

export default function Combobox<Id extends string = string>(props: ComboboxProps<Id>) {
  const listboxId = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [width, setWidth] = createSignal(0);
  let root: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  const results = createOptionSearch({
    active: open,
    delay: 150,
    query,
    search: (text) => props.search(text),
  });

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

  const show = () => {
    if (props.disabled) return;
    setWidth(root?.offsetWidth ?? 0);
    setOpen(true);
  };

  const pick = (option: ComboboxOption<Id> | undefined) => {
    if (!option || full()) return;
    setQuery("");
    if (props.multiple) props.onChange([...props.value, option]);
    else {
      props.onChange([option]);
      setOpen(false);
    }
  };

  const remove = (id: Id) => props.onChange(props.value.filter((option) => option.id !== id));

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
      const last = props.value.at(-1);
      if (last) remove(last.id);
    }
  };

  const selectedOption = () => (props.multiple ? undefined : props.value[0]);
  const single = () => selectedOption()?.label;

  return (
    <div
      class={["combobox flex-align-center", { disabled: props.disabled }]}
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
        aria-expanded={ariaBoolean(open())}
        aria-label={props.ariaLabel}
        class="combobox-input input-plain"
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
