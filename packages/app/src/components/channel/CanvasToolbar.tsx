import { IconButton, type IconName } from "@slock/ui";
import type Quill from "quill";
import { type Accessor, createEffect, createSignal, For, type JSX, onCleanup } from "solid-js";
import {
  currentFormats,
  type InlineFormat,
  quoteActive,
  redo,
  setParagraph,
  shiftIndent,
  toggleBlock,
  toggleInline,
  toggleQuote,
  undo,
} from "../../lib/canvas/canvasFormatting";
import CanvasInsertMenu from "./CanvasInsertMenu";
import "./CanvasToolbar.css";

interface ToolbarAction {
  active: (formats: Record<string, unknown>) => boolean;
  icon: IconName;
  label: string;
  run: (quill: Quill) => void;
}

const inline = (format: InlineFormat, icon: IconName, label: string): ToolbarAction => ({
  active: (formats) => !!formats[format],
  icon,
  label,
  run: (quill) => toggleInline(quill, format),
});

const heading = (level: number, icon: IconName): ToolbarAction => ({
  active: (formats) => formats.header === level,
  icon,
  label: `Heading ${level}`,
  run: (quill) => toggleBlock(quill, "header", level),
});

const list = (value: string, icon: IconName, label: string): ToolbarAction => ({
  active: (formats) =>
    value === "check"
      ? formats.list === "checked" || formats.list === "unchecked"
      : formats.list === value,
  icon,
  label,
  run: (quill) => toggleBlock(quill, "list", value === "check" ? "unchecked" : value),
});

const GROUPS: ToolbarAction[][] = [
  [
    { active: () => false, icon: "undo", label: "Undo", run: undo },
    { active: () => false, icon: "redo", label: "Redo", run: redo },
  ],
  [
    {
      active: (formats) => !(formats.header || formats.list || formats["code-block"]),
      icon: "paragraph",
      label: "Text",
      run: setParagraph,
    },
    heading(1, "heading-1"),
    heading(2, "heading-2"),
    heading(3, "heading-3"),
  ],
  [
    list("bullet", "bulleted-list", "Bulleted list"),
    list("ordered", "numbered-list", "Numbered list"),
    list("check", "check-list", "Checklist"),
    {
      active: () => false,
      icon: "indent-left",
      label: "Outdent",
      run: (quill) => shiftIndent(quill, -1),
    },
    {
      active: () => false,
      icon: "indent-right",
      label: "Indent",
      run: (quill) => shiftIndent(quill, 1),
    },
  ],
  [
    inline("bold", "bold", "Bold"),
    inline("italic", "italic", "Italic"),
    inline("underline", "underline", "Underline"),
    inline("strike", "strikethrough", "Strikethrough"),
    inline("code", "code", "Inline code"),
  ],
  [
    {
      active: quoteActive,
      icon: "quote",
      label: "Quote",
      run: toggleQuote,
    },
    {
      active: (formats) => !!formats["code-block"],
      icon: "code-block",
      label: "Code block",
      run: (quill) => toggleBlock(quill, "code-block", true),
    },
  ],
];

export default function CanvasToolbar(props: {
  children?: JSX.Element;
  editor: Accessor<Quill | undefined>;
  newId: () => string;
  onComment: (quill: Quill) => void;
}) {
  const [formats, setFormats] = createSignal<Record<string, unknown>>({});

  createEffect(() => {
    const quill = props.editor();
    if (!quill) return;
    const update = () => setFormats(currentFormats(quill));
    update();
    quill.on("editor-change", update);
    onCleanup(() => quill.off("editor-change", update));
  });

  return (
    <div aria-label="Canvas formatting" class="canvas-toolbar" role="toolbar">
      <div class="canvas-toolbar-actions">
        <For each={GROUPS}>
          {(group) => (
            <div class="canvas-toolbar-group">
              <For each={group}>
                {(action) => (
                  <IconButton
                    active={action.active(formats())}
                    aria-pressed={action.active(formats())}
                    icon={action.icon}
                    label={action.label}
                    onClick={() => {
                      const quill = props.editor();
                      if (!quill) return;
                      quill.focus();
                      action.run(quill);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    size="sm"
                  />
                )}
              </For>
            </div>
          )}
        </For>
        <div class="canvas-toolbar-group">
          <IconButton
            icon="add-comment"
            label="Comment"
            onClick={() => {
              const quill = props.editor();
              if (quill) props.onComment(quill);
            }}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
          />
          <CanvasInsertMenu editor={props.editor} formats={formats} newId={props.newId} />
        </div>
      </div>
      {props.children}
    </div>
  );
}
