import type { RichTextInputProps } from "@slock/blockkit";
import { narrowByType } from "@slock/core";
import type { Block, RichTextBlock } from "@slock/types";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import type Quill from "@slock/ui/editor/quill";
import { createEffect } from "solid-js";
import "../api/MrkdwnComposer.css";
import { buildRichTextBlocks } from "../lib/richTextBuild";
import { loadRichTextIntoQuill } from "../lib/richTextLoad";

const FORMATS = ["bold", "code", "italic", "link", "strike", "blockquote", "list", "code-block"];

export default function RichTextInput(props: RichTextInputProps) {
  let quill: Quill | undefined;

  createEffect(() => quill?.enable(!props.disabled));

  return (
    <div class="mrkdwn-composer multiline" classList={{ disabled: props.disabled }}>
      <QuillEditor
        ariaMultiline
        formats={FORMATS}
        onReady={(q) => {
          quill = q;
          if (props.initial) loadRichTextIntoQuill(q, [props.initial]);
          q.enable(!props.disabled);
          q.on("text-change", () => {
            const value = buildRichTextBlocks(q)
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
