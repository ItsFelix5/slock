import { markChannelRead } from "@slock/slack-api";

export function createMarkAllAsRead(deps: {
  channelIds: () => string[];
  dmIds: () => string[];
  clearUnread: (id: string) => void;
  setLastRead: (id: string, timestamp: number) => void;
}) {
  return function markAllAsRead() {
    const nowMs = Date.now();
    const now = String(nowMs / 1000);
    for (const id of [...deps.channelIds(), ...deps.dmIds()]) {
      deps.clearUnread(id);
      deps.setLastRead(id, nowMs);
      markChannelRead(id, now).catch(() => {});
    }
  };
}
