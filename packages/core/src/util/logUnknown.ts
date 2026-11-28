import { isRecord } from "./guards";

const logged = new Set<string>();

export function logUnknown(kind: string, value: unknown) {
  const line = `unknown ${kind}: ${String(isRecord(value) ? value.type : value)}`;
  if (logged.has(line)) return;
  logged.add(line);
  console.warn(line);
}
