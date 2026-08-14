import { For } from "solid-js";
import type { QuoteBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import type { AtomRenderers } from "../RunView";
import { pathKey } from "../selection";
import BlockView from "./BlockView";

export default function QuoteBlockView<A>(props: {
  block: QuoteBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  return (
    <blockquote class="rt-block bk-quote" data-rt-path={pathKey(props.blockPath)}>
      <For each={props.block.children}>
        {(child, ci) => (
          <BlockView
            atomRenderers={props.atomRenderers}
            block={child}
            blockPath={[...props.blockPath, ci()]}
            editor={props.editor}
          />
        )}
      </For>
    </blockquote>
  );
}
