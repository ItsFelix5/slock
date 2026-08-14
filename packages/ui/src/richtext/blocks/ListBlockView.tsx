import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { ListBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import RunView, { type AtomRenderers } from "../RunView";
import { pathKey } from "../selection";

export default function ListBlockView<A>(props: {
  block: ListBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  const tag = () => (props.block.style === "ordered" ? "ol" : "ul");

  return (
    <Dynamic class="rt-block bk-rt-list" component={tag()}>
      <For each={props.block.items}>
        {(item, ii) => {
          const itemPath = () => [...props.blockPath, ii()];
          return (
            <li data-rt-path={pathKey(itemPath())}>
              <Show when={props.block.style === "checkbox"}>
                <input
                  checked={!!item.checked}
                  class="rt-checkbox"
                  contentEditable={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => props.editor.toggleListItemChecked(itemPath())}
                  type="checkbox"
                />
              </Show>
              <span class="rt-list-item-text">
                <For each={item.runs}>
                  {(run, ri) => (
                    <RunView
                      atomRenderers={props.atomRenderers}
                      editor={props.editor}
                      path={[...itemPath(), ri()]}
                      run={run}
                    />
                  )}
                </For>
              </span>
            </li>
          );
        }}
      </For>
    </Dynamic>
  );
}
