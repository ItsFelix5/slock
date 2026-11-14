import type { Channel } from "@slock/types";
import { batch } from "solid-js";

export function createChannelActivityBatcher(
  patchChannel: (id: string, patch: Partial<Channel>) => void,
) {
  const pending = new Set<string>();
  const flush = () => {
    const at = Date.now();
    batch(() => {
      for (const id of pending) patchChannel(id, { lastActivity: at });
    });
    pending.clear();
  };
  return (channelId: string) => {
    if (pending.size === 0) requestAnimationFrame(flush);
    pending.add(channelId);
  };
}
