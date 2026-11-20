import { usePoint } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";

export function useChannelRows() {
  const rows = usePoint("home.channelRows");
  return { hasRows: (channelId: ChannelId) => rows().some((row) => row.active(channelId)), rows };
}
