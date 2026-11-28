import type { Block } from "./blocks";

interface LayoutItem {
  block: Block;
  horizontal_alignment?: "start" | "center" | "end";
  width?: "narrow" | "standard" | "wide";
}

interface LayoutRow {
  items: LayoutItem[];
}

export interface LayoutBlock {
  block_id?: string;
  grid_lines?: "none" | "rows" | "outer";
  is_label_visible?: boolean;
  label: string;
  rows: LayoutRow[];
  type: "layout";
}
