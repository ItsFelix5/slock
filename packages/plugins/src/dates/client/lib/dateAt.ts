import { type DateValue, dateValue } from "@slock/plugins/composer/client/api";
import type Quill from "@slock/ui/editor/quill";

export interface DateTarget {
  index: number;
  value: DateValue;
}

export function dateAt(quill: Quill, index: number): DateTarget | undefined {
  if (index < 0) return;
  const insert = quill.getContents(index, 1).ops[0]?.insert;
  const value = typeof insert === "object" ? dateValue(insert.date) : undefined;
  return value && { index, value };
}
