import { indexAlignedText, QuillEditor, scrollActiveListOption } from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, Show } from "solid-js";
import ComposerSuggestPopover from "./ComposerSuggestPopover";
import { wireEmojiAutoconvert } from "./lib/quillEmoji";
import { insertSuggestionAt, loadMrkdwnIntoQuill, mrkdwnText } from "./lib/quillMentions";
import { createSuggestionController } from "./lib/suggestionController";
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
  channelId?: string;
}) {
  let quill: Quill | undefined;
  let caretIndex = 0;
  let lastEmitted: string | undefined;
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);

  let rootRef: HTMLDivElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;

  const suggestions = createSuggestionController({
    applyTextSuggestion: (item, state) => {
      if (!quill) return;
      caretIndex = insertSuggestionAt(
        quill,
        state.start,
        caretIndex - state.start,
        item,
        state.kind,
      );
      quill.setSelection(caretIndex, 0);
    },
    channelId: () => props.channelId,
    includeBroadcastMentions: false,
    includeCommands: false,
    setSuggest,
    suggest,
  });

  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);

  createEffect(() => {
    suggest();
    scrollActiveListOption(() => suggestPopoverRef);
  });

  createEffect(() => {
    if (!quill || props.value === lastEmitted) return;
    lastEmitted = props.value;
    loadMrkdwnIntoQuill(quill, props.value);
  });

  createEffect(() => {
    quill?.enable(!props.disabled);
  });

  const onFocusOut = () => {
    queueMicrotask(() => {
      if (rootRef?.contains(document.activeElement)) return;
      setSuggest(null);
      props.onBlur?.();
    });
  };

  const handleKeyDownCapture = (event: KeyboardEvent): boolean => {
    if (!suggestOpen(suggest())) return false;
    if (event.key === "ArrowDown") {
      suggestions.moveActiveSuggestion(1);
      return true;
    }
    if (event.key === "ArrowUp") {
      suggestions.moveActiveSuggestion(-1);
      return true;
    }
    if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
      suggestions.applySuggestion();
      return true;
    }
    if (event.key === "Escape") {
      setSuggest(null);
      return true;
    }
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) setSuggest(null);
    return false;
  };

  return (
    <div
      aria-busy={props.ariaBusy}
      class="mrkdwn-composer"
      classList={{ disabled: props.disabled, multiline: props.multiline }}
      onFocusOut={onFocusOut}
      ref={rootRef}
    >
      <QuillEditor
        ariaLabel={props.ariaLabel}
        ariaMultiline={props.multiline ?? false}
        extendedFormats={false}
        id={props.id}
        onKeyDownCapture={handleKeyDownCapture}
        onReady={(q) => {
          quill = q;
          loadMrkdwnIntoQuill(q, props.value);
          lastEmitted = props.value;
          wireEmojiAutoconvert(q);
          q.enable(!props.disabled);
          q.on("text-change", () => {
            const next = mrkdwnText(q);
            lastEmitted = next;
            props.onInput(next);
            const aligned = indexAlignedText(q);
            caretIndex = q.getSelection()?.index ?? aligned.length;
            suggestions.updateSuggestions(aligned, caretIndex);
          });
        }}
        onSubmit={props.multiline ? undefined : () => quill?.root.blur()}
        placeholder={props.placeholder}
      />
      <Show when={suggestOpen(suggest()) ? suggest() : undefined}>
        {(state) => (
          <ComposerSuggestPopover
            onHover={suggestions.setActiveSuggestion}
            onPick={suggestions.applySuggestion}
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
