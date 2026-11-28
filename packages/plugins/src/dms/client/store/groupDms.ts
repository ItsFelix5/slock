import { defineQuery } from "@slock/plugins/query/client/api";
import { fetchChannelInfo } from "@slock/plugins/slack/client/api";
import { mapGroupDm, parseChannelId } from "@slock/slack";
import type { ChannelId, RawChannel, UserId } from "@slock/types";
import { addGroupDmPeople } from "../requests";

export function createGroupDms(deps: {
  currentUserId: () => UserId | undefined;
  isKnown: (id: ChannelId) => boolean;
  promoteToChannel: (raw: RawChannel) => void;
  upsert: (group: ReturnType<typeof mapGroupDm>) => void;
}) {
  const info = defineQuery<ChannelId, RawChannel>({
    load: (id, { signal }) => fetchChannelInfo(id, signal),
    name: "groupDm",
  });

  function apply(raw: RawChannel) {
    if (raw.is_mpim) deps.upsert(mapGroupDm(raw, deps.currentUserId()));
    else deps.promoteToChannel(raw);
  }

  return {
    async addPeople(id: ChannelId, userIds: UserId[], historyStartTs?: string) {
      const raw = await addGroupDmPeople(id, userIds, historyStartTs);
      apply(raw);
      return parseChannelId(raw.id);
    },
    async ensure(id: ChannelId) {
      if (!deps.isKnown(id)) apply(await info.ensure(id));
    },
    async refresh(id: ChannelId) {
      try {
        apply(await info.refresh(id));
      } catch (err) {
        console.error("Failed to refresh group chat", err);
      }
    },
  };
}
