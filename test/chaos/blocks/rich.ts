import { chance, int, pick, uid } from "../random";
import type { Obj } from "../slack";
import { codeBlob, EMOJI, words } from "../text";
import type { World } from "../world";
import { element } from "./elements";

const style = (): Obj =>
  chance(0.5)
    ? {}
    : { style: { bold: chance(0.5), italic: chance(0.5), strike: chance(0.2), code: chance(0.2) } };

const inlineOne = (w: World): Obj =>
  pick<() => Obj>([
    () => ({ type: "text", text: words(int(1, 6)), ...style() }),
    () => ({
      type: "link",
      url: `https://example.com/${uid()}`,
      ...(chance(0.6) ? { text: words(2) } : {}),
      ...style(),
    }),
    () => ({ type: "emoji", name: pick(EMOJI) }),
    () => ({ type: "user", user_id: pick(w.users) }),
    () => ({ type: "channel", channel_id: pick(w.channels) }),
    () => ({ type: "broadcast", range: pick(["here", "channel"]) }),
    () => ({
      type: "date",
      timestamp: 1795680000 + int(0, 9000000),
      format: "{date_long_pretty} at {time}",
      fallback: words(2),
    }),
    () => ({ type: "color", value: `#${int(0, 0xffffff).toString(16).padStart(6, "0")}` }),
  ])();

const inlineRun = (w: World): Obj[] => Array.from({ length: int(1, 8) }, () => inlineOne(w));
const sectionOf = (w: World): Obj => ({ type: "rich_text_section", elements: inlineRun(w) });
const listOf = (w: World): Obj => ({
  type: "rich_text_list",
  style: pick(["bullet", "ordered"]),
  indent: int(0, 3),
  border: 0,
  elements: Array.from({ length: int(1, 6) }, () => sectionOf(w)),
});
const quoteOf = (w: World): Obj => ({ type: "rich_text_quote", elements: inlineRun(w) });
const preformatted = (): Obj => ({
  type: "rich_text_preformatted",
  border: 0,
  ...(chance(0.5)
    ? { language: pick(["javascript", "python", "bash", "sql", "json", "rust"]) }
    : {}),
  elements: [{ type: "text", text: codeBlob() }],
});

const parts: ((w: World) => Obj)[] = [sectionOf, listOf, quoteOf, preformatted];

export const richText = (w: World): Obj => ({
  type: "rich_text",
  elements: Array.from({ length: int(1, 6) }, () => pick(parts)(w)),
});

const cellText = (budget: number): string => words(1).slice(0, Math.max(1, Math.min(budget, 30)));
const rawNumber = (value: number): Obj => ({ type: "raw_number", value, text: String(value) });

const tableCell = (w: World, budget: number, rich: boolean): Obj =>
  pick<() => Obj>(
    [
      () => ({ type: "raw_text", text: cellText(budget) }),
      () => rawNumber(int(-1000000, 1000000)),
      () => ({
        type: "rich_text",
        elements: [{ type: "rich_text_section", elements: [inlineOne(w)] }],
      }),
    ].slice(0, rich ? 3 : 2),
  )();

export const table = (w: World): Obj => {
  const rows = int(1, 100);
  const cols = int(1, 20);
  const rich = rows * cols < 200;
  const budget = Math.floor(9000 / (rows * cols));
  return {
    type: "table",
    rows: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => tableCell(w, budget, rich)),
    ),
    column_settings: Array.from({ length: cols }, () => ({
      is_wrapped: chance(0.5),
      align: pick(["left", "center", "right"]),
    })),
  };
};

const dataCell = (w: World, budget: number): Obj =>
  pick<() => Obj>([
    () => ({ type: "raw_text", text: cellText(budget) }),
    () => rawNumber(int(-1000, 1000)),
    () => ({
      type: "action_cell",
      element: element("button", w),
      fallback: { type: "raw_text", text: cellText(budget) },
    }),
  ])();

export const dataTable = (w: World): Obj => {
  const rows = int(2, 100);
  const cols = int(1, 20);
  const budget = Math.floor(18000 / (rows * cols));
  return {
    type: "data_table",
    caption: words(3),
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, () =>
        r === 0 ? { type: "raw_text", text: cellText(budget) } : dataCell(w, budget),
      ),
    ),
  };
};

export const dataViz = (): Obj => {
  const labels = Array.from({ length: int(2, 12) }, (_, i) => `${words(1)} ${i}`);
  const title = words(4);
  const kind = pick(["pie", "bar", "area", "line"]);
  if (kind === "pie") {
    return {
      type: "data_visualization",
      title,
      chart: { type: "pie", segments: labels.map((label) => ({ label, value: int(1, 1000) })) },
    };
  }
  return {
    type: "data_visualization",
    title,
    chart: {
      type: kind,
      series: Array.from({ length: int(1, 12) }, () => ({
        name: words(2),
        data: labels.map((label) => ({ label, value: int(0, 100000) })),
      })),
      axis_config: { categories: labels, x_label: words(2), y_label: words(2) },
    },
  };
};
