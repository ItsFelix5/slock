import { scrollActiveListOption } from "@slock/ui";
import { createEffect, createSignal, Show } from "solid-js";
import ComposerSuggestPopover from "./ComposerSuggestPopover";
import { createSuggestionController, suggestionText } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestOpen } from "./lib/suggestTypes";
import { useSuggestUi } from "./lib/useSuggestUi";
import "./MrkdwnComposer.css";

export default function MrkdwnComposer(props: {
  id: string;
  value: string;
  onInput: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  multiline?: boolean;
  ariaBusy?: boolean;
}) {
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  let inputRef: HTMLTextAreaElement | undefined;

  let rootRef: HTMLDivElement | undefined;

  let suggestPopoverRef: HTMLDivElement | undefined;
  const suggestions = createSuggestionController({
    applyTextSuggestion: (item, state) => {
      if (!inputRef) return;
      inputRef.setRangeText(
        suggestionText(item, state.kind),
        state.start,
        inputRef.selectionStart,
        "end",
      );
      props.onInput(inputRef.value);
    },
    includeCommands: false,
    setSuggest,
    suggest,
  });

  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);

  createEffect(() => {
    if (inputRef && inputRef.value !== props.value) inputRef.value = props.value;
  });

  createEffect(() => {
    suggest();
    scrollActiveListOption(() => suggestPopoverRef);
  });

  const updateSuggestions = (input: HTMLTextAreaElement) => {
    suggestions.updateSuggestions(input.value, input.selectionStart);
  };

  const applySuggestion = (index?: number) => {
    suggestions.applySuggestion(index);
  };

  const onInput = (event: InputEvent) => {
    const input = event.currentTarget as HTMLTextAreaElement;
    props.onInput(input.value);
    updateSuggestions(input);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const input = event.currentTarget as HTMLTextAreaElement;
    const state = suggest();
    if (state?.items.length && !(event.metaKey || event.ctrlKey || event.altKey)) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        suggestions.moveActiveSuggestion(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySuggestion();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (!props.multiline && event.key === "Enter") {
      event.preventDefault();
      input.blur();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "End", "Home"].includes(event.key)) setSuggest(null);
    queueMicrotask(() => updateSuggestions(input));
  };

  const onFocusOut = () => {
    queueMicrotask(() => {
      if (rootRef?.contains(document.activeElement)) return;
      setSuggest(null);
      props.onBlur?.();
    });
  };

  return (
    <div
      aria-busy={props.ariaBusy}
      class="mrkdwn-composer"
      classList={{ disabled: props.disabled, multiline: props.multiline }}
      onFocusOut={onFocusOut}
      ref={rootRef}
    >
      <textarea
        aria-label={props.ariaLabel}
        aria-multiline={props.multiline ?? false}
        class="mrkdwn-composer-input composer-input input-reset"
        disabled={props.disabled}
        id={props.id}
        onInput={onInput}
        onKeyDown={onKeyDown}
        placeholder={props.placeholder}
        ref={(el) => {
          inputRef = el;
          el.value = props.value;
        }}
        rows={props.multiline ? 3 : 1}
      />
      <Show when={suggestOpen(suggest()) ? suggest() : undefined}>
        {(state) => (
          <ComposerSuggestPopover
            onHover={suggestions.setActiveSuggestion}
            onPick={applySuggestion}
            ref={(el) => {
              suggestPopoverRef = el;
            }}
            state={state()}
          />
        )}
      </Show>
    </div>
  );
}
