import type { ChannelId } from "@slock/types";
import type { createDmsStore } from "../store";

export function isDmId(id: ChannelId, isKnownDm: (id: ChannelId) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}

declare module "@slock/core/types" {
  interface Services {
    dms: ReturnType<typeof createDmsStore>;
  }
}
