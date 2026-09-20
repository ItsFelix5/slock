import type { ProfileFieldDef } from "../../lib/api";

const BUILT_IN_LABELS = new Set(["title", "start date"]);

export function isCustomFieldDef(field: ProfileFieldDef): boolean {
  if (field.fieldName === "start_date") return false;
  return !BUILT_IN_LABELS.has(field.label.trim().toLowerCase());
}

export function mergeMissingProfileFieldValues(
  current: Record<string, string>,
  definitions: ProfileFieldDef[],
  values: Array<{ id: string; value: string }>,
): Record<string, string> {
  const valueById = new Map(values.map((field) => [field.id, field.value]));
  let next = current;
  for (const field of definitions) {
    if (field.id in current) continue;
    if (next === current) next = { ...current };
    next[field.id] = valueById.get(field.id) ?? "";
  }
  return next;
}
