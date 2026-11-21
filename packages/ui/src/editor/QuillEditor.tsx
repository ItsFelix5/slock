import { service } from "@slock/core/solid";
import { createMemo, createSignal, onSettled } from "solid-js";
import { bindLinePrefix, type LinePrefixFormat } from "./blockShortcuts";
import ContextBlot from "./ContextBlot";
import DividerBlot from "./DividerBlot";
import { useEditorShortcuts } from "./editorShortcuts";
import { wireEmbedCaretEscape } from "./embedCaret";
import FormatBubble from "./format/FormatBubble";
import LinkEditPopover from "./format/LinkEditPopover";
import { createLinkEditController } from "./format/linkEdit";
import { wireLinkAutoconvert } from "./linkAutolink";
import { wireListOffsetCleanup } from "./listOffset";
import { wireArrowDownExit, wireMarkdownAutoformat } from "./markdownAutoformat";
import Quill from "./quill";
import { BASE_FORMATS, EXTENDED_FORMATS, quillKeyboardBindings } from "./quillKeyboard";
import { pasteCaptureHandler, stripPastedHeader } from "./quillPaste";
import "./editor.css";
import "./editorLists.css";

const ui = service("ui");

export interface QuillEditorProps {
  checklists?: boolean;
  extendedFormats?: boolean;
  formats?: string[];
  id?: string;
  keepPastedHeaders?: boolean;
  linePrefixes?: LinePrefixFormat[];
  ariaLabel?: string;
  ariaMultiline?: boolean;
  onPasteFiles?: (files: FileList) => void;
  onPasteText?: (quill: Quill, event: ClipboardEvent) => boolean;
  onReady: (quill: Quill) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

const LINE_PREFIX_FORMATS: LinePrefixFormat[] = [
  { prefix: /^>$/, length: 1, format: "blockquote", value: true },
  { prefix: /^#$/, length: 1, format: "header", value: 1 },
  { prefix: /^##$/, length: 2, format: "header", value: 2 },
  { prefix: /^###$/, length: 3, format: "header", value: 3 },
  { prefix: /^####$/, length: 4, format: "header", value: 4 },
];

export default function QuillEditor(props: QuillEditorProps) {
  let container: HTMLDivElement | undefined;
  let quill: Quill | undefined;
  const [mounted, setMounted] = createSignal<Quill>();
  const formats = createMemo(
    () =>
      props.formats ??
      ((props.extendedFormats ?? true) ? [...BASE_FORMATS, ...EXTENDED_FORMATS] : BASE_FORMATS),
  );
  const linkEdit = createLinkEditController(() => quill);
  useEditorShortcuts(() => quill, {
    extendedFormats: props.formats?.includes("code-block") ?? props.extendedFormats ?? true,
    onSubmit: () => props.onSubmit,
  });

  onSettled(() => {
    if (!container) return;
    const activeFormats = formats();
    const has = (name: string) => activeFormats.includes(name);
    const editor: Quill = new Quill(container, {
      formats: has("list") ? [...activeFormats, "listOffset"] : activeFormats,
      modules: {
        keyboard: {
          bindings: quillKeyboardBindings(() => editor, activeFormats, props.checklists ?? false),
        },
        history: true,
        clipboard: {
          matchers: props.keepPastedHeaders ? [] : [["h1, h2, h3, h4, h5, h6", stripPastedHeader]],
        },
      },
      placeholder: props.placeholder,
    });
    quill = editor;
    setMounted(editor);

    if (props.id) editor.root.id = props.id;
    if (props.ariaLabel) editor.root.setAttribute("aria-label", props.ariaLabel);
    editor.root.setAttribute("role", "textbox");
    if (props.ariaMultiline !== undefined)
      editor.root.setAttribute("aria-multiline", String(props.ariaMultiline));

    if (has("divider")) DividerBlot.bindShortcut(editor);
    if (has("context")) ContextBlot.bindShortcut(editor);
    for (const lineFormat of [...LINE_PREFIX_FORMATS, ...(props.linePrefixes ?? [])]) {
      if (has(lineFormat.format)) bindLinePrefix(editor, lineFormat);
    }

    wireMarkdownAutoformat(editor, has("code-block"));
    wireArrowDownExit(editor);
    if (has("list")) wireListOffsetCleanup(editor);
    wireLinkAutoconvert(editor);
    const unwireEmbedCaretEscape = wireEmbedCaretEscape(editor);
    editor.on("text-change", linkEdit.revalidate);
    editor.root.addEventListener("click", linkEdit.handleClick);
    editor.root.addEventListener("dblclick", linkEdit.handleDoubleClick);

    props.onReady(editor);

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (ui.shortcuts.dispatchManual(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handlePasteCapture = pasteCaptureHandler(editor, {
      onPasteFiles: props.onPasteFiles,
      onPasteText: props.onPasteText,
    });
    container.addEventListener("keydown", handleKeyDownCapture, true);
    container.addEventListener("paste", handlePasteCapture, true);

    return () => {
      unwireEmbedCaretEscape();
      editor.root.removeEventListener("click", linkEdit.handleClick);
      editor.root.removeEventListener("dblclick", linkEdit.handleDoubleClick);
      container?.removeEventListener("keydown", handleKeyDownCapture, true);
      container?.removeEventListener("paste", handlePasteCapture, true);
    };
  });

  return (
    <>
      <div class="ql-editor-root" ref={container} />
      <FormatBubble formats={formats()} quill={mounted()} />
      <LinkEditPopover
        anchor={() => linkEdit.state()?.anchorEl}
        onClose={linkEdit.close}
        onUpdate={linkEdit.update}
        open={!!linkEdit.state()}
        text={linkEdit.state()?.text ?? ""}
        url={linkEdit.state()?.url ?? ""}
      />
    </>
  );
}
