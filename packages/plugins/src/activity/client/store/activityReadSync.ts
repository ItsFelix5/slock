import type { ChannelId, Ts } from "@slock/types";
import { createSignal } from "solid-js";

export function createActivityReadSync(
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>,
) {
  const [failedCount, setFailedCount] = createSignal(0);
  const [pendingCount, setPendingCount] = createSignal(0);
  const failures = new Map<ChannelId, Ts>();
  const epochs = new Map<ChannelId, number>();
  const pendingCounts = new Map<ChannelId, number>();

  async function request(channelId: ChannelId, ts: Ts): Promise<boolean> {
    const epoch = (epochs.get(channelId) ?? 0) + 1;
    epochs.set(channelId, epoch);
    pendingCounts.set(channelId, (pendingCounts.get(channelId) ?? 0) + 1);
    setPendingCount(pendingCounts.size);
    try {
      const synced = await syncChannelRead(channelId, ts).catch(() => false);
      if (epochs.get(channelId) !== epoch) return false;
      if (synced) failures.delete(channelId);
      else failures.set(channelId, ts);
      setFailedCount(failures.size);
      return synced;
    } finally {
      const remaining = (pendingCounts.get(channelId) ?? 1) - 1;
      if (remaining > 0) pendingCounts.set(channelId, remaining);
      else pendingCounts.delete(channelId);
      setPendingCount(pendingCounts.size);
    }
  }

  async function retry(): Promise<void> {
    await Promise.all([...failures].map(([channelId, ts]) => request(channelId, ts)));
  }

  return { error: () => failedCount() > 0, isPending: () => pendingCount() > 0, request, retry };
}
