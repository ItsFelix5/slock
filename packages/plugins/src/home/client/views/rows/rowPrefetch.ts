import { usePoint } from "@slock/core/solid";

export function useRowPrefetch(channelId: () => string) {
  const prefetchers = usePoint("messages.prefetch");
  const run = () => {
    for (const prefetch of prefetchers()) prefetch(channelId());
  };
  return { onFocus: run, onPointerEnter: run };
}
