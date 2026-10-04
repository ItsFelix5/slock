import { tableGrid } from "./canvasTable.ts";
import { blockquoteChildIds, calloutChildIds, sectionChildIds } from "./layoutContent.ts";
import { asMessage, field } from "./protobufRaw.ts";
import type { SectionRecord } from "./sections.ts";

export function descendantIds(record: SectionRecord): string[] {
  const content = asMessage(field(record.msg, 12));
  if (!content) return [];
  return [
    ...calloutChildIds(content),
    ...blockquoteChildIds(content),
    ...sectionChildIds(content),
    ...(tableGrid(content)?.cellContentIds.values() ?? []),
  ];
}
