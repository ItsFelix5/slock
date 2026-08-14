import { For } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { TableBlock } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import RunView, { type AtomRenderers } from "../RunView";
import { pathKey } from "../selection";

export default function TableBlockView<A>(props: {
  block: TableBlock<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  return (
    <div class="rt-block rt-table bk-table-scroll" data-rt-path={pathKey(props.blockPath)}>
      <table class="bk-table">
        <tbody>
          <For each={props.block.rows}>
            {(row, ri) => (
              <tr>
                <For each={row.cells}>
                  {(cell, ci) => {
                    const cellPath = () => [...props.blockPath, ri(), ci()];
                    return (
                      <Dynamic component={ri() === 0 ? "th" : "td"}>
                        <For each={cell.runs}>
                          {(run, runI) => (
                            <RunView
                              atomRenderers={props.atomRenderers}
                              editor={props.editor}
                              path={[...cellPath(), runI()]}
                              run={run}
                            />
                          )}
                        </For>
                      </Dynamic>
                    );
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div class="rt-table-controls" contentEditable={false}>
        <button onClick={() => props.editor.addTableRow(props.blockPath)} type="button">
          + row
        </button>
        <button onClick={() => props.editor.addTableColumn(props.blockPath)} type="button">
          + column
        </button>
      </div>
    </div>
  );
}
