import type { TableBlock } from "@slock/types";
import { For, Show } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";
import RichText from "./RichText";
import "./Table.css";

function Cell(props: {
  blockId?: string;
  cell: TableBlock["rows"][number][number];
  context?: BlockActionContext;
}) {
  if (props.cell.type === "action_cell")
    return (
      <Show when={props.cell.element}>
        {(el) => <ElementRenderer blockId={props.blockId} context={props.context} el={el()} />}
      </Show>
    );
  return props.cell.type === "rich_text" ? (
    <RichText block={{ elements: props.cell.elements ?? [], type: "rich_text" }} />
  ) : (
    (props.cell.text ?? props.cell.value)
  );
}

export function Table(props: { block: TableBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-table-scroll">
      <table class="bk-table">
        <Show when={props.block.caption}>{(caption) => <caption>{caption()}</caption>}</Show>
        <tbody>
          <For each={props.block.rows}>
            {(row, rowIndex) => (
              <tr>
                <For each={row}>
                  {(cell, index) => {
                    const setting = () => props.block.column_settings?.[index()] ?? undefined;
                    const style = () => ({
                      "text-align": setting()?.align,
                      "white-space": setting()?.is_wrapped ? "normal" : "nowrap",
                    });
                    const content = () => (
                      <Cell blockId={props.block.block_id} cell={cell} context={props.context} />
                    );
                    return (
                      <Show fallback={<td style={style()}>{content()}</td>} when={rowIndex() === 0}>
                        <th scope="col" style={style()}>
                          {content()}
                        </th>
                      </Show>
                    );
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
