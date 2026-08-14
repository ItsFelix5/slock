import { For } from "solid-js";
import type { ContextBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import RunView, { type AtomRenderers } from "../RunView";
import { pathKey } from "../selection";

export default function ContextBlockView<A>(props: {
  block: ContextBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  return (
    <div class="rt-block bk-context" data-rt-path={pathKey(props.blockPath)}>
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
