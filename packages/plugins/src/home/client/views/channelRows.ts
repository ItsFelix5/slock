import { usePoint } from "@slock/core/solid";

export function useChannelRows() {
  const rows = usePoint("home.channelRows");
  return { hasRows: (channelId: string) => rows().some((row) => row.active(channelId)), rows };
}
