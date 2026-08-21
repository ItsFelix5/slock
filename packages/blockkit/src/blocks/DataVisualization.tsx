import type { Chart, ChartAxisConfig, ChartSeries, DataVisualizationBlock } from "@slock/types";
import { For, Match, Show, Switch } from "solid-js";

const CHART_W = 300;
const CHART_H = 140;
const CHART_PAD = 10;

function seriesColorVar(index: number) {
  return `var(--bk-chart-series-${(index % 4) + 1})`;
}

function seriesValues(series: ChartSeries[], categories: string[]) {
  return series.map((s) =>
    categories.map((c, i) => s.data.find((p) => p.label === c) ?? s.data[i]),
  );
}

function Legend(props: { items: { label: string; color: string }[] }) {
  return (
    <div class="bk-chart-legend">
      <For each={props.items}>
        {(item) => (
          <div class="bk-chart-legend-item">
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        )}
      </For>
    </div>
  );
}

function AxisCaption(props: { axisConfig?: ChartAxisConfig }) {
  return (
    <Show when={props.axisConfig?.x_label || props.axisConfig?.y_label}>
      <div class="bk-chart-axis-labels">
        <Show when={props.axisConfig?.y_label}>
          <span class="bk-chart-axis-label-y">{props.axisConfig?.y_label}</span>
        </Show>
        <Show when={props.axisConfig?.x_label}>
          <span class="bk-chart-axis-label-x">{props.axisConfig?.x_label}</span>
        </Show>
      </div>
    </Show>
  );
}

function BarChart(props: { series: ChartSeries[]; categories: string[] }) {
  const rows = () => seriesValues(props.series, props.categories);
  const innerW = CHART_W - CHART_PAD * 2;
  const innerH = CHART_H - CHART_PAD * 2;
  const bounds = () => {
    const values = rows().flatMap((r) => r.map((p) => p?.value ?? 0));
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    return { max: max === min ? max + 1 : max, min };
  };
  const toY = (value: number) => {
    const { max, min } = bounds();
    return CHART_PAD + innerH - ((value - min) / (max - min)) * innerH;
  };
  const zeroY = () => toY(0);
  const groupW = () => innerW / Math.max(1, props.categories.length);
  const barW = () => groupW() / Math.max(1, props.series.length) - 4;

  return (
    <svg class="bk-chart-svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <line
        stroke="var(--border-strong)"
        x1={CHART_PAD}
        x2={CHART_W - CHART_PAD}
        y1={zeroY()}
        y2={zeroY()}
      />
      <For each={props.categories}>
        {(_category, ci) => (
          <For each={rows()}>
            {(row, si) => {
              const value = row[ci()]?.value ?? 0;
              const x = CHART_PAD + ci() * groupW() + si() * (barW() + 4) + 2;
              const top = Math.min(toY(value), zeroY());
              const height = Math.max(Math.abs(toY(value) - zeroY()), 1);
              return (
                <rect
                  fill={seriesColorVar(si())}
                  height={height}
                  rx={2}
                  width={Math.max(barW(), 1)}
                  x={x}
                  y={top}
                />
              );
            }}
          </For>
        )}
      </For>
    </svg>
  );
}

function LineChart(props: { series: ChartSeries[]; categories: string[]; filled?: boolean }) {
  const rows = () => seriesValues(props.series, props.categories);
  const innerW = CHART_W - CHART_PAD * 2;
  const innerH = CHART_H - CHART_PAD * 2;
  const bounds = () => {
    const values = rows().flatMap((r) => r.map((p) => p?.value ?? 0));
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    return { max: max === min ? max + 1 : max, min };
  };
  const toX = (index: number) => {
    const count = props.categories.length;
    return CHART_PAD + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  };
  const toY = (value: number) => {
    const { max, min } = bounds();
    return CHART_PAD + innerH - ((value - min) / (max - min)) * innerH;
  };
  const zeroY = () => toY(0);

  return (
    <svg class="bk-chart-svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <line
        stroke="var(--border-strong)"
        x1={CHART_PAD}
        x2={CHART_W - CHART_PAD}
        y1={zeroY()}
        y2={zeroY()}
      />
      <For each={rows()}>
        {(row, si) => {
          const points = row.map((p, i) => ({ x: toX(i), y: toY(p?.value ?? 0) }));
          const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const areaPath = `${linePath} L${points.at(-1)?.x},${zeroY()} L${points[0]?.x},${zeroY()} Z`;
          return (
            <>
              <Show when={props.filled}>
                <path d={areaPath} fill={seriesColorVar(si())} fill-opacity={0.18} stroke="none" />
              </Show>
              <path d={linePath} fill="none" stroke={seriesColorVar(si())} stroke-width={2} />
              <For each={points}>
                {(p) => <circle cx={p.x} cy={p.y} fill={seriesColorVar(si())} r={2.5} />}
              </For>
            </>
          );
        }}
      </For>
    </svg>
  );
}

function PieChart(props: { segments: { label: string; value: number }[] }) {
  const total = () => props.segments.reduce((sum, s) => sum + (s.value ?? 0), 0) || 1;
  const gradient = () => {
    let acc = 0;
    return props.segments
      .map((s, i) => {
        const start = (acc / total()) * 360;
        acc += s.value ?? 0;
        return `${seriesColorVar(i)} ${start}deg ${(acc / total()) * 360}deg`;
      })
      .join(", ");
  };
  return (
    <div class="bk-chart-pie-wrap">
      <div class="bk-chart-pie" style={{ background: `conic-gradient(${gradient()})` }} />
      <Legend
        items={props.segments.map((s, i) => ({
          color: seriesColorVar(i),
          label: `${s.label} (${s.value})`,
        }))}
      />
    </div>
  );
}

function seriesLegend(series: ChartSeries[]) {
  return series.map((s, i) => ({ color: seriesColorVar(i), label: s.name }));
}

export function DataVisualization(props: { block: DataVisualizationBlock }) {
  const chart = () => props.block.chart as Chart;
  return (
    <section class="bk-chart">
      <div class="bk-chart-title">{props.block.title}</div>
      <Switch fallback={<div class="bk-chart-empty">Unsupported chart: {chart().type}</div>}>
        <Match when={chart().type === "pie"}>
          <PieChart
            segments={(chart() as { segments: { label: string; value: number }[] }).segments}
          />
        </Match>
        <Match when={chart().type === "bar"}>
          {(() => {
            const c = chart() as { axis_config: ChartAxisConfig; series: ChartSeries[] };
            return (
              <>
                <BarChart categories={c.axis_config.categories} series={c.series} />
                <Legend items={seriesLegend(c.series)} />
                <AxisCaption axisConfig={c.axis_config} />
              </>
            );
          })()}
        </Match>
        <Match when={chart().type === "line" || chart().type === "area"}>
          {(() => {
            const c = chart() as { axis_config: ChartAxisConfig; series: ChartSeries[] };
            return (
              <>
                <LineChart
                  categories={c.axis_config.categories}
                  filled={chart().type === "area"}
                  series={c.series}
                />
                <Legend items={seriesLegend(c.series)} />
                <AxisCaption axisConfig={c.axis_config} />
              </>
            );
          })()}
        </Match>
      </Switch>
    </section>
  );
}
