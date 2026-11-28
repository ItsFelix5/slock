function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!(isObject(a) && isObject(b))) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key in b && deepEqual(a[key], b[key]));
}
