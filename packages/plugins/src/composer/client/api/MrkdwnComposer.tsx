import type { ChannelId } from "@slock/types";
import { scrollActiveListOption } from "@slock/ui";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import type Quill from "@slock/ui/editor/quill";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { mrkdwnText } from "../lib/deltaLines";
import { createEditorPlugins } from "../lib/editorPlugins";
import ComposerSuggestPopover from "./editor/ComposerSuggestPopover";
import MentionHoverCard from "./editor/MentionHoverCard";
import { createMentionHoverController } from "./editor/mentionHover";
import { useMentionResolution } from "./editor/mentionResolution";
import {
  insertSuggestionAt,
  loadMrkdwnIntoQuill,
  pasteBlocksClipboard,
} from "./editor/mrkdwnInsert";
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
  channelId?: ChannelId;
}) {
  const [editor, setEditor] = createSignal<Quill>();
  let caretIndex = 0;
  let lastEmitted: string | undefined;
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const resolveMention = useMentionResolution(editor);
  const mentionHover = createMentionHoverController();
  const editorPlugins = createEditorPlugins(editor);

  const disposers: Array<() => void> = [];
  onCleanup(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  let rootRef: HTMLDivElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;

  const suggestions = createSuggestionController({
    applyTextSuggestion: (item, state) => {
      const quill = editor();
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

  createEffect(suggest, () => scrollActiveListOption(() => suggestPopoverRef));

  createEffect(
    () => ({ quill: editor(), value: props.value }),
    ({ quill, value }) => {
      if (!quill || value === lastEmitted) return;
      lastEmitted = value;
      loadMrkdwnIntoQuill(quill, value, resolveMention);
    },
  );

  createEffect(
    () => ({ disabled: props.disabled, quill: editor() }),
    ({ disabled, quill }) => {
      quill?.enable(!disabled);
    },
  );

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
      class={["mrkdwn-composer", { disabled: props.disabled, multiline: props.multiline }]}
      onFocusOut={onFocusOut}
      ref={rootRef}
    >
      <QuillEditor
        ariaLabel={props.ariaLabel}
        ariaMultiline={props.multiline ?? false}
        extendedFormats={false}
        id={props.id}
        onPasteText={(q, event) => pasteBlocksClipboard(q, event, resolveMention)}
        onReady={(q) => {
          loadMrkdwnIntoQuill(q, props.value, resolveMention);
          lastEmitted = props.value;
          disposers.push(mentionHover.bind(q), ...editorPlugins.bind(q));
          setEditor(q);
          q.on("text-change", () => {
            const next = mrkdwnText(q.getContents().ops);
            lastEmitted = next;
            props.onInput(next);
            const aligned = indexAlignedText(q);
            syncSuggestionsAfterChange(q, aligned, suggestions, (index) => {
              caretIndex = index;
            });
          });
        }}
        onSubmit={props.multiline ? undefined : () => editor()?.root.blur()}
        placeholder={props.placeholder}
      />
      <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
      {editorPlugins.popover()}
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
