import { For } from "solid-js";
import type { ParagraphBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import RunView, { type AtomRenderers } from "../RunView";
import { pathKey } from "../selection";

export default function ParagraphBlockView<A>(props: {
  block: ParagraphBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
  placeholder?: string;
}) {
  // a lone atom run (an emoji/mention/date chip with no other text) is real content, not an
  // empty paragraph — only "no runs" or "a single blank text run" should show the placeholder
  const isEmpty = () => props.block.runs.every((r) => r.kind === "text" && r.text === "");

  return (
    <div
      class="rt-block rt-paragraph"
      data-placeholder={props.placeholder}
      data-rt-empty={isEmpty() ? "true" : undefined}
      data-rt-path={pathKey(props.blockPath)}
    >
      <For each={props.block.runs}>
        {(run, ri) => (
          <RunView
            atomRenderers={props.atomRenderers}
            editor={props.editor}
            path={[...props.blockPath, ri()]}
            run={run}
          />
        )}
      </For>
    </div>
  );
}
