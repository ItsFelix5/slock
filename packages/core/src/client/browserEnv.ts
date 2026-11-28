import { systemEnv } from "../env";
import type { Env } from "../types";

export const browserEnv: Env = {
  ...systemEnv,
  storage: {
    get: (key) => localStorage.getItem(key),
    remove: (key) => localStorage.removeItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    subscribe: (listener) => {
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === null || event.storageArea === localStorage) listener(event.key);
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  },
};
