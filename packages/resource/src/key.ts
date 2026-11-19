function sortKeys(_name: string, value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function stableKey(key: unknown): string {
  return JSON.stringify(key, sortKeys) ?? "undefined";
}
