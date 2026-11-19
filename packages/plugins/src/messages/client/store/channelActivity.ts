import { service } from "@slock/core/solid";
import type { Channel, ChannelId } from "@slock/types";
import { batch } from "solid-js";

const env = service("env");

export function createChannelActivityBatcher(
  patchChannel: (id: ChannelId, patch: Partial<Channel>) => void,
) {
  const pending = new Set<ChannelId>();
  const flush = () => {
    const at = env.now();
    batch(() => {
      for (const id of pending) patchChannel(id, { lastActivity: at });
    });
    pending.clear();
  };
  return (channelId: ChannelId) => {
    if (pending.size === 0) requestAnimationFrame(flush);
    pending.add(channelId);
  };
}
