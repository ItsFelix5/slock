import type { DataVisualizationBlock, TableBlock } from "@slock/slack-api";
import { For, Show } from "solid-js";
import RichText from "./RichText";

function Cell(props: { cell: TableBlock["rows"][number][number] }) {
  return props.cell.type === "rich_text" ? (
    <RichText block={{ elements: props.cell.elements ?? [], type: "rich_text" }} />
  ) : (
    <>{props.cell.text ?? props.cell.value}</>
  );
}

export function Table(props: { block: TableBlock }) {
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
                    return rowIndex() === 0 ? (
                      <th scope="col" style={style()}>
                        <Cell cell={cell} />
                      </th>
                    ) : (
                      <td style={style()}>
                        <Cell cell={cell} />
                      </td>
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

export function DataVisualization(props: { block: DataVisualizationBlock }) {
  const segments = () =>
    (props.block.chart as { segments?: { label?: string; value?: number }[] }).segments ?? [];
  const max = () => Math.max(1, ...segments().map((segment) => segment.value ?? 0));
  return (
    <section class="bk-chart">
      <div class="bk-chart-title">{props.block.title}</div>
      <Show
        fallback={<div class="bk-chart-empty">{props.block.chart.type} chart</div>}
        when={segments().length}
      >
        <div class="bk-chart-bars">
          <For each={segments()}>
            {(segment) => (
              <div class="bk-chart-row">
                <span>{segment.label}</span>
                <i style={{ width: `${((segment.value ?? 0) / max()) * 100}%` }} />
                <b>{segment.value}</b>
              </div>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
