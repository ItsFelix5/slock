import Quill from "quill";
import Block, { BlockEmbed } from "quill/blots/block";
import { onCleanup, onMount } from "solid-js";
import LinkEditPopover from "./LinkEditPopover";
import { linkifyBeforeSubmit, linkifySelectionPaste, wireLinkAutoconvert } from "./linkAutolink";
import { createLinkEditController } from "./linkEdit";
import { getEmbedBlot } from "./quillText";
import "./editor.css";

export interface QuillEditorProps {
  autofocus?: boolean;
  extendedFormats?: boolean;
  id?: string;
  ariaLabel?: string;
  ariaMultiline?: boolean;
  onKeyDownCapture?: (event: KeyboardEvent) => boolean;
  onPasteFiles?: (files: FileList) => void;
  onReady: (quill: Quill) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

class DividerBlot extends BlockEmbed {
  static blotName = "divider";
  static tagName = "hr";

  static create(value: unknown) {
    const node = BlockEmbed.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("divider blot produced a non-element node");
    node.contentEditable = "false";
    return node;
  }
}

class ContextBlot extends Block {
  static blotName = "context";
  static tagName = "aside";
}

Quill.register(DividerBlot);
Quill.register(ContextBlot);

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const WHITESPACE_RE = /\s/;
export const INLINE_MARKS: [char: string, format: "bold" | "italic" | "strike" | "code"][] = [
  ["*", "bold"],
  ["_", "italic"],
  ["~", "strike"],
  ["`", "code"],
];

export default function QuillEditor(props: QuillEditorProps) {
  let container: HTMLDivElement | undefined;
  let quill: Quill | undefined;
  const linkEdit = createLinkEditController(() => quill);

  onMount(() => {
    if (!container) return;
    const extendedFormats = props.extendedFormats ?? true;
    quill = new Quill(container, {
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
            submit: {
              key: "Enter",
              shiftKey: false,
              handler: () => {
                if (!props.onSubmit) return true;
                if (quill) linkifyBeforeSubmit(quill);
                props.onSubmit();
                return false;
              },
            },
            "embed backspace": {
              key: "Backspace",
              collapsed: true,
              handler(range: { index: number }) {
                if (!quill || range.index === 0) return true;
                const [leaf] = quill.getLeaf(range.index - 1);
                if (!(leaf instanceof getEmbedBlot())) return true;
                const text = leaf.domNode instanceof HTMLElement ? leaf.domNode.textContent : "";
                if (!text) return true;
                const at = range.index - 1;
                quill.deleteText(at, 1, "user");
                quill.insertText(at, text, "user");
                quill.setSelection(at + text.length, 0, "silent");
                return false;
              },
            },
            ...(extendedFormats
              ? {
                  "header enter": false,
                  "header shift enter": {
                    key: "Enter",
                    shiftKey: true,
                    collapsed: true,
                    format: ["header"],
                    handler(
                      range: { index: number },
                      context: { format: Record<string, unknown> },
                    ) {
                      if (!quill) return true;
                      quill.insertText(range.index, "\n", context.format, "user");
                      quill.formatLine(range.index + 1, 1, "header", false, "user");
                      quill.setSelection(range.index + 1, 0, "silent");
                      return false;
                    },
                  },
                  "context shift enter": {
                    key: "Enter",
                    shiftKey: true,
                    collapsed: true,
                    format: ["context"],
                    handler(
                      range: { index: number },
                      context: { format: Record<string, unknown> },
                    ) {
                      if (!quill) return true;
                      quill.insertText(range.index, "\n", context.format, "user");
                      quill.formatLine(range.index + 1, 1, "context", false, "user");
                      quill.setSelection(range.index + 1, 0, "silent");
                      return false;
                    },
                  },
                  "blockquote backspace": {
                    key: "Backspace",
                    collapsed: true,
                    offset: 0,
                    format: ["blockquote"],
                    handler() {
                      quill!.format("blockquote", false, "user");
                      return false;
                    },
                  },
                  "context backspace": {
                    key: "Backspace",
                    collapsed: true,
                    offset: 0,
                    format: ["context"],
                    handler() {
                      quill!.format("context", false, "user");
                      return false;
                    },
                  },
                }
              : {}),
          },
        },
        history: true,
        clipboard: true,
      },
      placeholder: props.placeholder,
    });

    if (props.id) quill.root.id = props.id;
    if (props.ariaLabel) quill.root.setAttribute("aria-label", props.ariaLabel);
    quill.root.setAttribute("role", "textbox");
    if (props.ariaMultiline !== undefined)
      quill.root.setAttribute("aria-multiline", String(props.ariaMultiline));

    if (extendedFormats) {
      quill.keyboard.addBinding({ key: "-" }, { prefix: /^--$/, offset: 2 }, (range) => {
        const at = range.index - 2;
        quill!.deleteText(at, 2);
        quill!.insertEmbed(at, "divider", true, "user");
        quill!.setSelection(at + 1, 0, "silent");
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^>$/, offset: 1 }, (range) => {
        quill!.deleteText(range.index - 1, 1);
        quill!.formatLine(range.index - 1, 1, "blockquote", true);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^-#$/, offset: 2 }, (range) => {
        quill!.deleteText(range.index - 2, 2);
        quill!.formatLine(range.index - 2, 1, "context", true);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^#$/, offset: 1 }, (range) => {
        quill!.deleteText(range.index - 1, 1);
        quill!.formatLine(range.index - 1, 1, "header", 1);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^##$/, offset: 2 }, (range) => {
        quill!.deleteText(range.index - 2, 2);
        quill!.formatLine(range.index - 2, 1, "header", 2);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^###$/, offset: 3 }, (range) => {
        quill!.deleteText(range.index - 3, 3);
        quill!.formatLine(range.index - 3, 1, "header", 3);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^####$/, offset: 4 }, (range) => {
        quill!.deleteText(range.index - 4, 4);
        quill!.formatLine(range.index - 4, 1, "header", 4);
        return false;
      });
      quill.keyboard.addBinding({ key: " " }, { prefix: /^```$/, offset: 3 }, (range) => {
        quill!.deleteText(range.index - 3, 3);
        quill!.formatLine(range.index - 3, 1, "code-block", true);
        return false;
      });
    }

    for (const [char, format] of INLINE_MARKS) {
      const escaped = char.replace(ESCAPE_RE, "\\$&");
      const prefix = new RegExp(`${escaped}([^${escaped}\\n]+)$`);
      quill.keyboard.addBinding({ key: char }, { prefix }, (range, context) => {
        const match = context.prefix.match(prefix);
        if (!match) return true;
        const start = range.index - match[0].length;
        const before = context.prefix[start - 1];
        if (before !== undefined && !WHITESPACE_RE.test(before)) return true;
        quill!.deleteText(start, match[0].length);
        quill!.insertText(start, match[1], format, true);
        quill!.setSelection(start + match[1].length, 0, "silent");
        quill!.format(format, false, "silent");
        return false;
      });
    }
    quill.keyboard.addBinding(
      { key: ["x", "X"], shiftKey: true, shortKey: true },
      {},
      (_range, context) => {
        quill!.format("strike", !context.format.strike, "user");
        return false;
      },
    );

    wireLinkAutoconvert(quill);
    quill.on("text-change", linkEdit.revalidate);
    quill.root.addEventListener("click", linkEdit.handleClick);
    quill.root.addEventListener("dblclick", linkEdit.handleDoubleClick);
    onCleanup(() => {
      quill?.root.removeEventListener("click", linkEdit.handleClick);
      quill?.root.removeEventListener("dblclick", linkEdit.handleDoubleClick);
    });

    if (props.autofocus) quill.focus();
    props.onReady(quill);

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (props.onKeyDownCapture?.(event)) {
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
      const text = event.clipboardData?.getData("text/plain");
      if (quill && text && linkifySelectionPaste(quill, text)) {
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
