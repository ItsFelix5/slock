import type Quill from "@slock/ui/editor/quill";
import { type DateValue, dateValue } from "../../../composer/client/api";

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
