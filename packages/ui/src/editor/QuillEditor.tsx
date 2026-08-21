import Quill from "quill";
import { onCleanup, onMount } from "solid-js";
import "./editor.css";

export interface QuillEditorProps {
  autofocus?: boolean;
  onKeyDownCapture?: (event: KeyboardEvent) => boolean;
  onReady: (quill: Quill) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

const BlockEmbed = Quill.import(
  "blots/block/embed",
) as typeof import("quill/blots/block").BlockEmbed;

class DividerBlot extends BlockEmbed {
  static blotName = "divider";
  static tagName = "hr";
}

Quill.register(DividerBlot);

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const WHITESPACE_RE = /\s/;
const INLINE_MARKS: [char: string, format: string][] = [
  ["*", "bold"],
  ["_", "italic"],
  ["~", "strike"],
  ["`", "code"],
];

export default function QuillEditor(props: QuillEditorProps) {
  let container: HTMLDivElement | undefined;
  let quill: Quill | undefined;

  onMount(() => {
    if (!container) return;
    quill = new Quill(container, {
      formats: [
        "bold",
        "code",
        "italic",
        "link",
        "strike",
        "blockquote",
        "header",
        "list",
        "code-block",
        "divider",
        "mention",
      ],
      modules: {
        keyboard: {
          bindings: {
            submit: {
              key: "Enter",
              shiftKey: false,
              handler: () => {
                if (!props.onSubmit) return true;
                props.onSubmit();
                return false;
              },
            },
          },
        },
        history: true,
        clipboard: true,
      },
      placeholder: props.placeholder,
    });

    quill.keyboard.addBinding({ key: "-" }, { prefix: /^--$/, offset: 2 }, (range) => {
      quill!.deleteText(range.index - 3, 3);
      quill!.insertEmbed(range.index - 2, "divider", true);
      if (quill!.getLength() <= range.index) quill!.insertText(range.index, "\n");
      return false;
    });
    quill.keyboard.addBinding({ key: " " }, { prefix: /^>$/, offset: 1 }, (range) => {
      quill!.deleteText(range.index - 1, 1);
      quill!.formatLine(range.index, 1, "blockquote");
      return false;
    });
    // Each header level needs its own exact-count match - unanchored regexes like /##/
    // also match "###", and since Quill tries bindings in registration order the H1
    // binding would always win first for "## " or deeper.
    quill.keyboard.addBinding({ key: " " }, { prefix: /^#$/, offset: 1 }, (range) => {
      quill!.deleteText(range.index - 1, 1);
      quill!.formatLine(range.index, 1, "header", 1);
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
    quill.keyboard.addBinding({ key: " " }, { prefix: /^#####$/, offset: 5 }, (range) => {
      quill!.deleteText(range.index - 5, 5);
      quill!.formatLine(range.index - 5, 1, "header", 5);
      return false;
    });

    // Inline wysiwyg: finishing a *bold*, _italic_, ~strike~ or `code` span
    // converts it live instead of leaving the raw delimiters on screen -
    // matches what Slack's own composer does. Each fires on typing its own
    // closing character, with the prefix regex finding the still-open
    // opening delimiter earlier in the same line (no fixed offset, since
    // the span can be any length).
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
        return false;
      });
    }
    quill.keyboard.addBinding(
      { key: "x", shiftKey: true, shortKey: true },
      {},
      (_range, context) => {
        quill!.format("strike", !context.format.strike, "user");
        return false;
      },
    );

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
  });

  return <div class="ql-editor-root" ref={container} />;
}
