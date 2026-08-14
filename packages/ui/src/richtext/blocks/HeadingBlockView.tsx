import { For } from "solid-js";
import type { HeadingBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import RunView, { type AtomRenderers } from "../RunView";
import { pathKey } from "../selection";

/** Level 1 renders with the exact `bk-header` class the sent `header` block uses — a real 1:1
 * match. Level >= 2 has no real Block Kit header equivalent (Slack has one header size), so it
 * degrades to bold text on send (see blockkit's `docToBlocks`) and is rendered as plain bold here
 * too — no fake size scaling, so what you see while typing is what gets sent. */
export default function HeadingBlockView<A>(props: {
  block: HeadingBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  const isRealHeader = () => props.block.level <= 1;

  return (
    <div
      class={isRealHeader() ? "rt-block bk-header" : "rt-block bk-rt-section rt-heading-bold"}
      data-rt-heading-level={props.block.level}
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
