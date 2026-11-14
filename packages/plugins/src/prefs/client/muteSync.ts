import { createLatestValueSync } from "../../query/client/api";
import { setMutedChannels } from "../../slack/client/api";

type MuteWrite = { ids: string[]; seq: number };

export function createMuteSync(onFailed: (confirmedIds: string[]) => void) {
  let seq = 0;
  let confirmedIds: string[] = [];
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
    confirm(ids: string[]) {
      confirmedIds = ids;
    },
    push: (ids: string[]) => sync.force({ ids, seq: ++seq }),
  };
}
