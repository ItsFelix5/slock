import { systemEnv } from "../env";
import type { EnabledStore, Env } from "../types";
import { isRecord } from "../util/guards";

function isBooleanEntry(entry: [string, unknown]): entry is [string, boolean] {
  return typeof entry[1] === "boolean";
}

export function localEnabledStore(
  key: string,
  storage: Env["storage"] = systemEnv.storage,
): EnabledStore {
  return {
    read() {
      try {
        const parsed: unknown = JSON.parse(storage.get(key) ?? "{}");
        return isRecord(parsed)
          ? Object.fromEntries(Object.entries(parsed).filter(isBooleanEntry))
          : {};
      } catch {
        return {};
      }
    },
    write(overrides) {
      try {
        storage.set(key, JSON.stringify(overrides));
        return true;
      } catch {
        return false;
      }
    },
  };
}
