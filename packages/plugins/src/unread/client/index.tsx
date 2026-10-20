import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { buildUnreadMap, parseBadgeCounts } from "@slock/slack";
import { isDmId } from "../../dms/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import { fetchCounts } from "../../slack/client/api";
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
  const onCounts = ctx.use("unread.counts");
  ctx.add("realtime.reconnect", async () => {
    const data = await fetchCounts().catch(() => undefined);
    if (!data) return;
    const counts = buildUnreadMap(data.unreads);
    for (const { id } of channels.channels()) {
      store.setUnreadChannelIds(id, !!counts[id]?.unread);
      channels.patchChannel(id, { mentions: counts[id]?.mentions || undefined });
    }
    for (const { id } of dms.directMessages()) {
      store.setUnreadChannelIds(id, !!counts[id]?.unread);
      dms.patchDm(id, { mentions: counts[id]?.mentions || undefined });
    }
    for (const run of onCounts()) run(data.notifications ?? {});
  });
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
      const mentions = event.mention_count ?? 0;
      if (isDmId(event.channel, (dmId) => !!dms.dmById(dmId)))
        dms.patchDm(event.channel, { mentions });
      else channels.patchChannel(event.channel, { mentions });
      const readTs = Number(event.ts) * 1000;
      if (Number.isFinite(readTs)) store.setLastReadByChannel(event.channel, readTs);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["thread_marked"], (event) => {
      if (event.thread_ts && event.last_read)
        store.setThreadReadTs(event.thread_ts, event.last_read);
    }),
  );
};

export default setup;
