function isPlain(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function equalData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a))
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => equalData(item, b[i]));
  if (a instanceof Set)
    return b instanceof Set && a.size === b.size && [...a].every((item) => b.has(item));
  if (a instanceof Map)
    return (
      b instanceof Map &&
      a.size === b.size &&
      [...a].every(([key, item]) => b.has(key) && equalData(item, b.get(key)))
    );
  if (!(isPlain(a) && isPlain(b))) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) => Object.hasOwn(b, key) && equalData(Reflect.get(a, key), Reflect.get(b, key)),
    )
  );
}

function naturalKey(value: unknown): unknown {
  return isPlain(value) ? (Reflect.get(value, "id") ?? Reflect.get(value, "ts")) : undefined;
}

function reuse(previous: unknown, next: unknown, write: (value: unknown) => void): void {
  if (equalData(previous, next)) write(previous);
  else adopt(previous, next);
}

function adopt(previous: unknown, next: unknown): void {
  if (Array.isArray(previous) && Array.isArray(next)) {
    const known = new Map(previous.map((item) => [naturalKey(item), item]));
    next.forEach((item, i) => {
      const key = naturalKey(item);
      reuse(key === undefined ? previous[i] : known.get(key), item, (value) => {
        next[i] = value;
      });
    });
  } else if (previous instanceof Map && next instanceof Map) {
    for (const [key, item] of next) reuse(previous.get(key), item, (value) => next.set(key, value));
  } else if (isPlain(previous) && isPlain(next)) {
    for (const key of Object.keys(next))
      reuse(Reflect.get(previous, key), Reflect.get(next, key), (value) =>
        Reflect.set(next, key, value),
      );
  }
}

export function share<T>(previous: T, next: T): T {
  if (equalData(previous, next)) return previous;
  adopt(previous, next);
  return next;
}
