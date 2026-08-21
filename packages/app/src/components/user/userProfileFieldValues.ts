import type { ProfileFieldDef } from "../../lib/api";

export function isCustomFieldDef(field: ProfileFieldDef): boolean {
  return field.fieldName !== "start_date" && field.label.trim().toLowerCase() !== "title";
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
