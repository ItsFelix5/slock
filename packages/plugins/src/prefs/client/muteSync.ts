import { createLatestValueSync } from "@slock/plugins/query/client/api";
import { setMutedChannels } from "@slock/plugins/slack/client/api";
import type { ChannelId } from "@slock/types";

type MuteWrite = { ids: ChannelId[]; seq: number };

export function createMuteSync(onFailed: (confirmedIds: ChannelId[]) => void) {
  let seq = 0;
  let confirmedIds: ChannelId[] = [];
  const sync = createLatestValueSync<MuteWrite>({
    key: () => "mutes",
    onError: (_write, error) => {
      console.error("Failed to set channel mute preference", error);
      onFailed(confirmedIds);
      return false;
    },
    version: (write) => write.seq,
    write: async (write) => {
      await setMutedChannels(write.ids);
      confirmedIds = write.ids;
    },
  });
  return {
    confirm(ids: ChannelId[]) {
      confirmedIds = ids;
    },
    push: (ids: ChannelId[]) => sync.force({ ids, seq: ++seq }),
  };
}
