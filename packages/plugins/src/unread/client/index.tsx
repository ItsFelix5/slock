import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { parseBadgeCounts } from "@slock/slack";
import { isDmId } from "../../dms/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import { createUnreadStore } from "./store";

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const channels = service("channels");
  const dms = service("dms");
  const store = createUnreadStore({
    bootstrap: () => bootstrap.bootstrap.data,
    patchChannel: channels.patchChannel,
    patchDm: dms.patchDm,
  });
  ctx.provide("unread", store);
  ctx.add("conversations.opened", (view) => store.clearChannelUnread(view.id));
  ctx.add(
    "realtime.handler",
    gatewayHandler(["badge_counts_updated"], (event) => {
      for (const [id, { unread, mentions }] of Object.entries(parseBadgeCounts(event))) {
        store.setUnreadChannelIds(id, unread);
        if (isDmId(id, (dmId) => !!dms.dmById(dmId))) dms.patchDm(id, { mentions });
        else channels.patchChannel(id, { mentions });
      }
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["channel_marked"], (event) => {
      if (!(event.channel && event.ts) || store.isStaleReadEcho(event.channel, event.ts)) return;
      store.setUnreadChannelIds(event.channel, (event.unread_count ?? 0) > 0);
      channels.patchChannel(event.channel, { mentions: event.mention_count ?? 0 });
      const readTs = Number(event.ts) * 1000;
      if (Number.isFinite(readTs)) store.setLastReadByChannel(event.channel, readTs);
    }),
  );
};

export default setup;
