import { scrollActiveListOption } from "@slock/ui";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { mrkdwnText } from "../lib/quillMentions";
import ComposerSuggestPopover from "./editor/ComposerSuggestPopover";
import MentionHoverCard from "./editor/MentionHoverCard";
import { createMentionHoverController } from "./editor/mentionHover";
import { useMentionResolution } from "./editor/mentionResolution";
import {
  insertSuggestionAt,
  loadMrkdwnIntoQuill,
  pasteMrkdwnClipboard,
} from "./editor/mrkdwnInsert";
import { wireEmojiAutoconvert } from "./editor/quillEmoji";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "./editor/suggestionController";
import type { SuggestState } from "./editor/suggestTypes";
import { suggestOpen } from "./editor/suggestTypes";
import { useSuggestShortcuts } from "./editor/useSuggestShortcuts";
import { useSuggestUi } from "./editor/useSuggestUi";
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
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();

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
    loadMrkdwnIntoQuill(quill, props.value, resolveMention);
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

  useSuggestShortcuts({ setSuggest, suggest, suggestions });

  return (
    <div
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
        onPasteText={(q, event) => pasteMrkdwnClipboard(q, event, resolveMention)}
        onReady={(q) => {
          quill = q;
          loadMrkdwnIntoQuill(q, props.value, resolveMention);
          lastEmitted = props.value;
          wireEmojiAutoconvert(q);
          onCleanup(mentionHover.bind(q));
          q.enable(!props.disabled);
          q.on("text-change", () => {
            const next = mrkdwnText(q);
            lastEmitted = next;
            props.onInput(next);
            const aligned = indexAlignedText(q);
            syncSuggestionsAfterChange(q, aligned, suggestions, (index) => {
              caretIndex = index;
            });
          });
        }}
        onSubmit={props.multiline ? undefined : () => quill?.root.blur()}
        placeholder={props.placeholder}
      />
      <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
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
