import { createStore, produce } from "solid-js/store";

export function createActivityReadSync(
  syncChannelRead: (channelId: string, ts: string) => Promise<boolean>,
) {
  const [failures, setFailures] = createStore<Record<string, string>>({});
  const [pending, setPending] = createStore<Record<string, boolean>>({});
  const epochs = new Map<string, number>();
  const pendingCounts = new Map<string, number>();
  const error = () => Object.keys(failures).length > 0;
  const isPending = () => Object.keys(pending).length > 0;

  async function request(channelId: string, ts: string): Promise<boolean> {
    const epoch = (epochs.get(channelId) ?? 0) + 1;
    epochs.set(channelId, epoch);
    pendingCounts.set(channelId, (pendingCounts.get(channelId) ?? 0) + 1);
    setPending(channelId, true);
    try {
      const synced = await syncChannelRead(channelId, ts).catch(() => false);
      if (epochs.get(channelId) !== epoch) return false;
      if (synced) {
        setFailures(
          produce((current) => {
            delete current[channelId];
          }),
        );
      } else {
        setFailures(channelId, ts);
      }
      return synced;
    } finally {
      const remaining = (pendingCounts.get(channelId) ?? 1) - 1;
      if (remaining > 0) {
        pendingCounts.set(channelId, remaining);
      } else {
        pendingCounts.delete(channelId);
        setPending(
          produce((current) => {
            delete current[channelId];
          }),
        );
      }
    }
  }

  async function retry(): Promise<void> {
    await Promise.all(Object.entries(failures).map(([channelId, ts]) => request(channelId, ts)));
  }

  return { error, isPending, request, retry };
}
