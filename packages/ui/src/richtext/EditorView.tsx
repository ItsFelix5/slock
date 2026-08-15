import { For, onCleanup, onMount } from "solid-js";
import BlockView from "./blocks/BlockView";
import type { EditorHandle } from "./editorStore";
import type { AtomRenderers } from "./RunView";
import { domSelectionToRange, pathKey, rangeToDomSelection, redirectToFirstRun } from "./selection";
import { detectBlockShortcut } from "./shortcuts/blockShortcuts";
import { matchMarkShortcutKey } from "./shortcuts/keyboardMarks";
import { detectLinkShortcut, URL_RE } from "./shortcuts/linkShortcuts";
import { detectMarkShortcut } from "./shortcuts/markShortcuts";
import { adjacentCellPath } from "./tableNav";
import "./richtext.css";

export default function EditorView<A>(props: {
  editor: EditorHandle<A>;
  atomRenderers: AtomRenderers;
  placeholder?: string;
  ariaLabel?: string;
  onSubmit?: () => void;
  class?: string;
  /** Fires after the doc model and selection are both guaranteed fresh (end of `onInput`, and
   * after any pure caret move) — the hook a consumer (e.g. an @mention/emoji/slash suggestion
   * adapter) uses to read `editor.getCaretContext()` without racing the model update. */
  onCaretActivity?: () => void;
  /** Runs before this view's own key handling; returning true means "handled" and skips it —
   * lets a consumer intercept ArrowUp/Down/Enter/Escape while e.g. a suggestion popover is open. */
  onKeyDownCapture?: (event: KeyboardEvent) => boolean;
}) {
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let rootRef: HTMLDivElement | undefined;

  const syncSelection = () => {
    if (!rootRef) return;
    const sel = window.getSelection();
    if (!(sel && rootRef.contains(sel.anchorNode))) return;
    const range = domSelectionToRange(rootRef, sel);
    if (range) {
      // clicking an empty run resolves to its block container, not the run itself (see
      // redirectToFirstRun) — correct both our model AND the real browser caret, so subsequent
      // native typing actually lands inside the run instead of as a stray sibling of it.
      const redirected = redirectToFirstRun(rootRef, range.focus.path);
      if (redirected) {
        range.anchor = redirected;
        range.focus = redirected;
        rangeToDomSelection(rootRef, range);
      }
    }
    props.editor.setSelection(range);
  };

  const onBeforeInput = (event: InputEvent) => {
    const { editor } = props;
    syncSelection();
    const selection = editor.getSelection();
    if (!selection) return;
    const crossBlock = selection.anchor.path[0] !== selection.focus.path[0];

    if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
      // shift+enter is treated the same as enter, except inside a codeblock — there it's always
      // a literal newline in the text, never a block split (a codeblock is one opaque string).
      event.preventDefault();
      if (crossBlock) editor.deleteSelection();
      if (editor.convertPipeRowsToTableAtCaret()) return;
      if (!editor.insertNewlineInCodeblock()) editor.splitBlockAtCaret();
      return;
    }
    if (event.inputType === "deleteContentBackward") {
      const collapsed =
        selection.anchor.path.join(",") === selection.focus.path.join(",") &&
        selection.anchor.offset === selection.focus.offset;
      if (!collapsed) {
        event.preventDefault();
        editor.deleteSelection();
        return;
      }
      if (editor.mergeWithPreviousBlock()) event.preventDefault();
      return;
    }
    if (event.inputType === "deleteContentForward") {
      const collapsed =
        selection.anchor.path.join(",") === selection.focus.path.join(",") &&
        selection.anchor.offset === selection.focus.offset;
      if (!collapsed) {
        event.preventDefault();
        editor.deleteSelection();
        return;
      }
      if (editor.mergeWithNextBlock()) event.preventDefault();
      return;
    }
    if (crossBlock) {
      // any other edit (typing over a cross-block selection) — collapse it first, ourselves
      event.preventDefault();
      editor.deleteSelection();
      if (event.data)
        editor.replaceTriggerRange(editor.getCaretContext()?.caretOffset ?? 0, {
          id: crypto.randomUUID?.() ?? String(Math.random()),
          kind: "text",
          marks: [],
          text: event.data,
        });
    }
  };

  const checkMarkShortcut = () => {
    const { editor } = props;
    const caret = editor.getCaretContext();
    if (!caret) return;
    const match = detectMarkShortcut(caret.text, caret.caretOffset);
    if (!match) return;
    editor.replaceTriggerRange(match.start, {
      id: crypto.randomUUID?.() ?? String(Math.random()),
      kind: "text",
      marks: [match.mark],
      text: match.text,
    });
  };

  const checkLinkShortcut = () => {
    const { editor } = props;
    const caret = editor.getCaretContext();
    if (!caret) return;
    const match = detectLinkShortcut(caret.text, caret.caretOffset);
    if (!match) return;
    editor.replaceTriggerRange(match.start, {
      id: crypto.randomUUID?.() ?? String(Math.random()),
      kind: "link",
      marks: [],
      text: match.text,
      url: match.url,
    });
  };

  /** Only a plain, still-untouched top-level paragraph (a 2-segment run path) can convert — an
   * already-converted heading/list/etc, or a nested container, never re-triggers this. */
  const checkBlockShortcut = () => {
    const { editor } = props;
    const selection = editor.getSelection();
    if (selection?.focus.path.length !== 2) return;
    const caret = editor.getCaretContext();
    if (!caret) return;
    const match = detectBlockShortcut(caret.text);
    if (!match) return;
    editor.convertBlockAtCaret(match);
  };

  // `input`/`beforeinput` events on a contenteditable region target the editing host itself, not
  // the specific descendant that changed — so which leaf to sync is read from the live selection
  // (which does report the real focus node), not `event.target`.
  const onInput = () => {
    syncSelection();
    const selection = props.editor.getSelection();
    if (selection && rootRef) {
      const { path } = selection.focus;
      const leaf = rootRef.querySelector<HTMLElement>(`[data-rt-path="${pathKey(path)}"]`);
      if (leaf && leaf.getAttribute("data-rt-atom") !== "true") {
        props.editor.updateRunText(path, leaf.textContent ?? "");
      }
    }
    checkBlockShortcut();
    checkLinkShortcut();
    checkMarkShortcut();
    props.onCaretActivity?.();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (props.onKeyDownCapture?.(event)) return;
    const { editor } = props;
    if (event.key === "Tab") {
      const selection = editor.getSelection();
      if (selection?.focus.path.length === 4) {
        event.preventDefault();
        const next = adjacentCellPath(
          editor.getDoc(),
          selection.focus.path,
          event.shiftKey ? -1 : 1,
        );
        if (next && rootRef) {
          const range = { anchor: { offset: 0, path: next }, focus: { offset: 0, path: next } };
          editor.setSelection(range);
          rangeToDomSelection(rootRef, range);
        }
        return;
      }
    }
    const markKey = matchMarkShortcutKey(event);
    if (markKey) {
      event.preventDefault();
      editor.toggleMark(markKey);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      editor.redo();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && props.onSubmit) {
      event.preventDefault();
      props.onSubmit();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const { editor } = props;
    const text = event.clipboardData?.getData("text/plain");
    if (text === undefined) return;
    event.preventDefault();
    syncSelection();
    const selection = editor.getSelection();
    if (!selection) return;
    const collapsed =
      selection.anchor.path.join(",") === selection.focus.path.join(",") &&
      selection.anchor.offset === selection.focus.offset;
    // pasting a bare URL over a selection turns the selected text into a link, keeping its label
    if (!collapsed && URL_RE.test(text.trim())) {
      editor.applyLinkToSelection(text.trim());
      return;
    }
    if (!collapsed) editor.deleteSelection();
    editor.replaceTriggerRange(editor.getCaretContext()?.caretOffset ?? 0, {
      id: crypto.randomUUID?.() ?? String(Math.random()),
      kind: "text",
      marks: [],
      // multi-line paste collapses to spaces — the doc model has no soft-line-break concept,
      // pasting a multi-block structure is a possible future extension, not attempted here.
      text: text.replace(/\r?\n/g, " "),
    });
  };

  const onCopy = (event: ClipboardEvent) => {
    const { editor } = props;
    const selection = editor.getSelection();
    if (!(selection && event.clipboardData)) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", sel.toString());
  };

  onMount(() => {
    if (rootRef) props.editor.setRoot(rootRef);
    // programmatic doc changes (split/merge/insert-atom/toggle-mark) set editor.getSelection()
    // themselves; once the resulting DOM has rendered, push that back into the real browser
    // selection — this is the one deliberate, explicit caret-placement path.
    const unsubscribe = props.editor.onChange(() => {
      queueMicrotask(() => {
        const range = props.editor.getSelection();
        if (rootRef && range) rangeToDomSelection(rootRef, range);
      });
    });
    onCleanup(unsubscribe);
  });

  return (
    <div
      aria-label={props.ariaLabel}
      class={`rt-editor ${props.class ?? ""}`}
      contentEditable
      onBeforeInput={onBeforeInput}
      onCopy={onCopy}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onKeyUp={() => {
        syncSelection();
        props.onCaretActivity?.();
      }}
      onMouseUp={() => {
        syncSelection();
        props.onCaretActivity?.();
      }}
      onPaste={onPaste}
      ref={rootRef}
      role="textbox"
      spellcheck
    >
      <For each={props.editor.doc.blocks}>
        {(block, index) => (
          <BlockView
            atomRenderers={props.atomRenderers}
            block={block}
            blockPath={[index()]}
            editor={props.editor}
            placeholder={index() === 0 ? props.placeholder : undefined}
          />
        )}
      </For>
    </div>
  );
}
