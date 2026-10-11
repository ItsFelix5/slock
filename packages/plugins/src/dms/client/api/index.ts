import type { createDmsStore } from "../store";

export function isDmId(id: string, isKnownDm: (id: string) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}

declare module "@slock/core/types" {
  interface Services {
    dms: ReturnType<typeof createDmsStore>;
  }
}
