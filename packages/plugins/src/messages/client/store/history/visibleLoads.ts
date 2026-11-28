import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import type { ChannelId } from "@slock/types";
import { createEffect, untrack } from "solid-js";
import { channelsNeedingRecentHistory } from "./loadPlan";

export function loadNewlyVisible(deps: {
  atPresent: (channelId: ChannelId) => boolean;
  load: (channelId: ChannelId) => Promise<void>;
  visibleMessageTargets: () => ChannelMessageTarget[];
  visibleViews: () => View[];
}) {
  let previousViewIds: ChannelId[] = [];
  // A new pane mounts after its target is landed and cleared, so targets are held until then.
  const awaitingMount = new Set<ChannelId>();
  createEffect(
    () => ({
      targetIds: deps.visibleMessageTargets().map((target) => target.channelId),
      viewIds: deps.visibleViews().map((view) => view.id),
    }),
    ({ targetIds, viewIds }) => {
      untrack(() => {
        for (const id of targetIds) if (!previousViewIds.includes(id)) awaitingMount.add(id);
        const toLoad = channelsNeedingRecentHistory({
          atPresent: deps.atPresent,
          previousViewIds,
          targetChannelIds: [...awaitingMount],
          viewIds,
        });
        for (const id of viewIds) awaitingMount.delete(id);
        previousViewIds = viewIds;
        for (const id of toLoad) void deps.load(id);
      });
    },
  );
}
