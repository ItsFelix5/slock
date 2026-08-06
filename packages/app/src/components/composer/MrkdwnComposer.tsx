import { createEffect, createSignal, For, Show } from "solid-js";
import { createEditorCommands } from "./lib/editor/editorCommands";
import { handleMarkShortcut } from "./lib/editor/markShortcuts";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestItemContent } from "./lib/suggestTypes";
import { useSuggestUI } from "./lib/useSuggestUI";
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
  let loadedValue: string | undefined;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this through the JSX ref.
  let rootRef: HTMLDivElement | undefined;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this through the JSX ref.
  let suggestPopoverRef: HTMLDivElement | undefined;

  const emitValue = (value: string) => {
    loadedValue = value;
    props.onInput(value);
  };
  const editor = createEditorCommands({
    allowBlockKit: false,
    closeSuggestions: () => setSuggest(null),
    resetLinkPreviews: () => {},
    setText: emitValue,
  });
  const suggestions = createSuggestionController({
    currentTextContext: editor.currentTextContext,
    includeCommands: false,
    setSuggest,
    suggest,
    syncFromDom: editor.syncFromDom,
  });

  useSuggestUI(() => suggestPopoverRef, suggest, setSuggest);

  createEffect(() => {
    const { value } = props;
    if (value === loadedValue) return;
    loadedValue = value;
    editor.loadDraftIntoEditor(value);
  });

  createEffect(() => {
    const state = suggest();
    if (!(state && suggestPopoverRef)) return;
    suggestPopoverRef
      .querySelector<HTMLElement>(`.composer-suggest-row:nth-child(${state.active + 1})`)
      ?.scrollIntoView({ block: "nearest" });
  });

  const onInput = () => {
    editor.normalizeStrayEmptyBlock();
    editor.maybeConvertTypedEmojiShortcode();
    editor.maybeLinkifyTypedUrl();
    editor.syncFromDom();
    const el = editor.getRef();
    if (!props.value.trim() && el?.childNodes.length) el.innerHTML = "";
    const context = editor.currentTextContext();
    if (context) suggestions.updateSuggestions(context.node.textContent ?? "", context.offset);
    else setSuggest(null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const state = suggest();
    if (state?.items.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        suggestions.moveActiveSuggestion(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        suggestions.applySuggestion();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (event.key === "Enter" && !props.multiline) {
      event.preventDefault();
      editor.getRef()?.blur();
      return;
    }
    handleMarkShortcut(event, editor);
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
      {/* biome-ignore lint/a11y/useSemanticElements: mrkdwn formatting requires a contenteditable. */}
      <div
        aria-label={props.ariaLabel}
        aria-multiline={props.multiline ?? false}
        class="mrkdwn-composer-input composer-input input-reset"
        contentEditable={!props.disabled}
        data-placeholder={props.placeholder}
        id={props.id}
        onCopy={(event) => editor.copySelection(event)}
        onCut={(event) => editor.cutSelection(event)}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = event.clipboardData?.getData("text/plain") ?? "";
          if (!pasted) return;
          editor.insertPastedTextAtCaret(
            props.multiline ? pasted : pasted.replace(/\s*\n\s*/g, " "),
          );
          editor.linkifyAll();
        }}
        ref={editor.setRef}
        role="textbox"
        tabIndex={props.disabled ? -1 : 0}
      />
      <Show when={suggest()}>
        {(state) => (
          <div class="menu-panel composer-suggest-popover" ref={suggestPopoverRef}>
            <For each={state().items}>
              {(item, index) => (
                <button
                  class="composer-suggest-row btn-reset flex-align-center"
                  classList={{ active: index() === state().active }}
                  onClick={() => suggestions.applySuggestion(index())}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => suggestions.setActiveSuggestion(index())}
                  type="button"
                >
                  {suggestItemContent(item)}
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}
