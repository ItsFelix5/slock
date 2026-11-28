import type { RichTextInputProps } from "@slock/blockkit";
import { narrowByType } from "@slock/core";
import type { Block, RichTextBlock } from "@slock/types";
import { INLINE_STYLE_FORMATS } from "@slock/ui/editor/inlineFormats";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import type Quill from "@slock/ui/editor/quill";
import { createSignal } from "solid-js";
import "../api/MrkdwnComposer.css";
import { useQuillEnabled } from "../api/editor/useQuillEnabled";
import { buildRichTextBlocks } from "../lib/richTextBuild";
import { loadRichTextIntoQuill } from "../lib/richTextLoad";

const FORMATS = [...INLINE_STYLE_FORMATS, "link", "blockquote", "list", "listOffset", "code-block"];

export default function RichTextInput(props: RichTextInputProps) {
  const [editor, setEditor] = createSignal<Quill>();

  useQuillEnabled(editor, () => props.disabled);

  return (
    <div class={["mrkdwn-composer multiline", { disabled: props.disabled }]}>
      <QuillEditor
        ariaMultiline
        formats={FORMATS}
        onReady={(q) => {
          if (props.initial) loadRichTextIntoQuill(q, [props.initial]);
          setEditor(q);
          q.on("text-change", () => {
            const value = buildRichTextBlocks(q.getContents().ops)
              .map((block) => narrowByType<Block, RichTextBlock>(block, "rich_text"))
              .find(Boolean);
            if (value) props.onChange(value);
          });
        }}
        placeholder={props.placeholder}
      />
    </div>
  );
}
