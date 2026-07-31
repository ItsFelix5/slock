export function createMarkAllAsRead(deps: {
  channelIds: () => string[];
  dmIds: () => string[];
  clearUnread: (id: string) => void;
  setChannelRead: (id: string, ts: string) => Promise<boolean>;
  setLastRead: (id: string, timestamp: number) => void;
}) {
  return async function markAllAsRead(): Promise<boolean> {
    const nowMs = Date.now();
    const now = (nowMs / 1000).toFixed(6);
    const results = await Promise.all(
      [...deps.channelIds(), ...deps.dmIds()].map(async (id) => {
        if (!(await deps.setChannelRead(id, now))) return false;
        deps.clearUnread(id);
        deps.setLastRead(id, nowMs);
        return true;
      }),
    );
    return results.every(Boolean);
  };
}
