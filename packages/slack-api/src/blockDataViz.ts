import type { RichTextBlock } from "./richText";

export interface TableCell {
  elements?: RichTextBlock["elements"];
  text?: string;
  type: "raw_text" | "raw_number" | "rich_text";
  value?: number;
}

export interface TableBlock {
  block_id?: string;
  column_settings?: ({
    align?: "left" | "center" | "right";
    is_wrapped?: boolean;
  } | null)[];
  rows: TableCell[][];
  type: "table" | "data_table";
  caption?: string;
  page_size?: number;
  row_header_column_index?: number;
}

export interface ChartSegment {
  label: string;
  value: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  data: ChartDataPoint[];
  name: string;
}

export interface ChartAxisConfig {
  categories: string[];
  x_label?: string;
  y_label?: string;
}

export type Chart =
  | { segments: ChartSegment[]; type: "pie" }
  | { axis_config: ChartAxisConfig; series: ChartSeries[]; type: "bar" | "area" | "line" };

export interface DataVisualizationBlock {
  block_id?: string;
  chart: Chart;
  title: string;
  type: "data_visualization";
}
