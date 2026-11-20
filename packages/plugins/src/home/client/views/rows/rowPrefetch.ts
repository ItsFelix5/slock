import { usePoint } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";

export function useRowPrefetch(channelId: () => ChannelId) {
  const prefetchers = usePoint("messages.prefetch");
  const run = () => {
    for (const prefetch of prefetchers()) prefetch(channelId());
  };
  return { onFocus: run, onPointerEnter: run };
}
