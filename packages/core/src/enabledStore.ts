import type { EnabledStore } from "./types";

export function localEnabledStore(key: string): EnabledStore {
  return {
    read() {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
        return typeof parsed === "object" && parsed !== null
          ? Object.fromEntries(
              Object.entries(parsed).filter(([, value]) => typeof value === "boolean"),
            )
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
