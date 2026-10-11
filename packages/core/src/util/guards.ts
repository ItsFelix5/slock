export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasType<All extends { type: string }, T extends All>(
  value: All | undefined,
  type: T["type"],
): value is T {
  return value?.type === type;
}

export function narrowByType<All extends { type: string }, T extends All>(
  value: All | undefined,
  type: T["type"],
): T | undefined {
  return hasType<All, T>(value, type) ? value : undefined;
}

export function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a defined value");
  return value;
}
