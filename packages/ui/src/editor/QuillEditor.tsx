import Quill from "quill";
import { onCleanup, onMount } from "solid-js";
import { dispatchManualShortcut } from "../useShortcut";
import { bindLinePrefix, type LinePrefixFormat } from "./blockShortcuts";
import ContextBlot from "./ContextBlot";
import DividerBlot from "./DividerBlot";
import { useEditorShortcuts } from "./editorShortcuts";
import { wireEmbedCaretEscape } from "./embedCaret";
import LinkEditPopover from "./LinkEditPopover";
import { linkifySelectionPaste, wireLinkAutoconvert } from "./linkAutolink";
import { createLinkEditController } from "./linkEdit";
import { INLINE_MARKS, wireArrowDownExit, wireMarkdownAutoformat } from "./markdownAutoformat";
import { getEmbedBlot } from "./quillText";
import "./editor.css";

export interface QuillEditorProps {
  extendedFormats?: boolean;
  id?: string;
  ariaLabel?: string;
  ariaMultiline?: boolean;
  onPasteFiles?: (files: FileList) => void;
  onPasteText?: (quill: Quill, event: ClipboardEvent) => boolean;
  onReady: (quill: Quill) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

const Delta = Quill.import("delta");
type Delta = InstanceType<typeof Delta>;

const LINE_PREFIX_FORMATS: LinePrefixFormat[] = [
  { prefix: /^>$/, length: 1, format: "blockquote", value: true },
  { prefix: /^#$/, length: 1, format: "header", value: 1 },
  { prefix: /^##$/, length: 2, format: "header", value: 2 },
  { prefix: /^###$/, length: 3, format: "header", value: 3 },
  { prefix: /^####$/, length: 4, format: "header", value: 4 },
];

const UNFORMAT_ON_BACKSPACE = ["blockquote", "context", "header", "code-block"];

function stripPastedHeader(_node: Element, delta: Delta) {
  return new Delta(
    delta.ops.map((op) => {
      if (!op.attributes?.header) return op;
      const { header: _header, ...attributes } = op.attributes;
      return { ...op, attributes };
    }),
  );
}

export default function QuillEditor(props: QuillEditorProps) {
  let container: HTMLDivElement | undefined;
  let quill: Quill | undefined;
  const linkEdit = createLinkEditController(() => quill);
  useEditorShortcuts(() => quill, {
    extendedFormats: props.extendedFormats ?? true,
    onSubmit: () => props.onSubmit,
  });

  onMount(() => {
    if (!container) return;
    const extendedFormats = props.extendedFormats ?? true;
    const editor = new Quill(container, {
      formats: [
        "bold",
        "code",
        "italic",
        "link",
        "strike",
        "mention",
        "emoji",
        ...(extendedFormats
          ? ["blockquote", "context", "header", "list", "code-block", "divider", "date"]
          : []),
      ],
      modules: {
        keyboard: {
          bindings: {
            bold: false,
            italic: false,
            "embed backspace": {
              key: "Backspace",
              collapsed: true,
              handler(range: { index: number }) {
                if (range.index === 0) return true;
                const [leaf, offset] = editor.getLeaf(range.index);
                if (!(leaf instanceof getEmbedBlot()) || offset === 0) return true;
                const text = leaf.contentNode.textContent;
                if (!text) return true;
                const at = leaf.offset(editor.scroll);
                editor.deleteText(at, 1, "user");
                editor.insertText(at, text, "user");
                editor.setSelection(at + text.length, 0, "silent");
                return false;
              },
            },
            ...Object.fromEntries(
              INLINE_MARKS.map(([, format]) => [
                `${format} backspace`,
                {
                  key: "Backspace",
                  collapsed: true,
                  format: [format],
                  handler(range: { index: number }) {
                    if (range.index > 0 && editor.getFormat(range.index - 1, 1)[format])
                      return true;
                    editor.format(format, false, "user");
                    return false;
                  },
                },
              ]),
            ),
            ...(extendedFormats
              ? {
                  "header enter": false,
                  ...Object.fromEntries(
                    UNFORMAT_ON_BACKSPACE.map((format) => [
                      `${format} backspace`,
                      {
                        key: "Backspace",
                        collapsed: true,
                        offset: 0,
                        format: [format],
                        handler() {
                          editor.format(format, false, "user");
                          return false;
                        },
                      },
                    ]),
                  ),
                }
              : {}),
          },
        },
        history: true,
        clipboard: { matchers: [["h1, h2, h3, h4, h5, h6", stripPastedHeader]] },
      },
      placeholder: props.placeholder,
    });
    quill = editor;

    if (props.id) editor.root.id = props.id;
    if (props.ariaLabel) editor.root.setAttribute("aria-label", props.ariaLabel);
    editor.root.setAttribute("role", "textbox");
    if (props.ariaMultiline !== undefined)
      editor.root.setAttribute("aria-multiline", String(props.ariaMultiline));

    if (extendedFormats) {
      DividerBlot.bindShortcut(editor);
      ContextBlot.bindShortcut(editor);
      for (const lineFormat of LINE_PREFIX_FORMATS) bindLinePrefix(editor, lineFormat);
    }

    wireMarkdownAutoformat(editor, extendedFormats);
    wireArrowDownExit(editor);
    wireLinkAutoconvert(editor);
    onCleanup(wireEmbedCaretEscape(editor));
    editor.on("text-change", linkEdit.revalidate);
    editor.root.addEventListener("click", linkEdit.handleClick);
    editor.root.addEventListener("dblclick", linkEdit.handleDoubleClick);
    onCleanup(() => {
      editor.root.removeEventListener("click", linkEdit.handleClick);
      editor.root.removeEventListener("dblclick", linkEdit.handleDoubleClick);
    });

    props.onReady(editor);

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (dispatchManualShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    container.addEventListener("keydown", handleKeyDownCapture, true);
    onCleanup(() => container?.removeEventListener("keydown", handleKeyDownCapture, true));

    const handlePasteCapture = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0 && props.onPasteFiles) {
        event.preventDefault();
        event.stopPropagation();
        props.onPasteFiles(files);
        return;
      }
      if (props.onPasteText?.(editor, event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const text = event.clipboardData?.getData("text/plain");
      if (text && linkifySelectionPaste(editor, text)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    container.addEventListener("paste", handlePasteCapture, true);
    onCleanup(() => container?.removeEventListener("paste", handlePasteCapture, true));
  });

  return (
    <>
      <div class="ql-editor-root" ref={container} />
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
