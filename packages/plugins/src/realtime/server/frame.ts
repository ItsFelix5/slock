import { isRecord } from "@slock/core";
import type { GatewayEvent } from "./api";

export function parseFrame(raw: string): GatewayEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRecord(value) && typeof value.type === "string" ? { ...value, type: value.type } : null;
}
