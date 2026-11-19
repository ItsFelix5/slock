import type { EnabledStore } from "../types";
import { isRecord } from "../util/guards";

function isBooleanEntry(entry: [string, unknown]): entry is [string, boolean] {
  return typeof entry[1] === "boolean";
}

export function localEnabledStore(key: string): EnabledStore {
  return {
    read() {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
        return isRecord(parsed)
          ? Object.fromEntries(Object.entries(parsed).filter(isBooleanEntry))
          : {};
      } catch {
        return {};
      }
    },
    write(overrides) {
      try {
        localStorage.setItem(key, JSON.stringify(overrides));
      } catch {}
    },
  };
}
