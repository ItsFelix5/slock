import type { Setup, TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import { isDmId } from "@slock/plugins/dms/client/api";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { buildUnreadMap, isChannelId, isTs, parseBadgeCounts, parseCountGroup } from "@slock/slack";
import type { ChannelId } from "@slock/types";
import { fetchLatestCounts, markChannelRead, markThreadRead } from "./requests";
import { createUnreadStore } from "./store";

const feedback = service("feedback");

const DELETION_REFRESH_MS = 500;

const setup: Setup = (ctx) => {
  const env = ctx.get("env");
  const bootstrap = service("bootstrap");
  const channels = service("channels");
  const dms = service("dms");
  let refreshTimer: TimerHandle | undefined;
  ctx.onCleanup(() => env.clearTimeout(refreshTimer));
  const refreshSoon = (ms: number) => {
    env.clearTimeout(refreshTimer);
    refreshTimer = env.setTimeout(() => void refreshCounts(), ms);
  };
  const store = createUnreadStore({
    api: { markChannelRead, markThreadRead },
    bootstrap: () => bootstrap.bootstrap().data,
    flash: (...args) => feedback.flash(...args),
    patchChannel: channels.patchChannel,
    patchDm: dms.patchDm,
  });
  ctx.provide("unread", store);
  const onCounts = ctx.use("unread.counts");
  let refreshSeq = 0;
  let eventClock = 0;
  const eventAt = new Map<ChannelId, number>();
  const touched = (id: ChannelId) => void eventAt.set(id, ++eventClock);
  let disposed = false;
  ctx.onCleanup(() => {
    disposed = true;
  });
  const refreshCounts = async () => {
    const seq = ++refreshSeq;
    const requestedAt = eventClock;
    const data = await fetchLatestCounts().catch(() => undefined);
    if (!data || disposed || seq !== refreshSeq) return;
    const counts = buildUnreadMap(data.unreads);
    const isNewer = (id: ChannelId) => (eventAt.get(id) ?? 0) > requestedAt;
    for (const { id } of channels.channels()) {
      if (isNewer(id)) continue;
      store.setUnreadChannelIds(id, !!counts[id]?.unread);
      channels.patchChannel(id, { mentions: counts[id]?.mentions ?? 0 });
    }
    for (const { id } of dms.directMessages()) {
      if (isNewer(id)) continue;
      store.setUnreadChannelIds(id, !!counts[id]?.unread);
      dms.patchDm(id, { mentions: counts[id]?.mentions ?? 0 });
    }
    for (const run of onCounts()) run(data.notifications ?? {});
  };
  ctx.add("realtime.reconnect", refreshCounts);
  ctx.add(
    "realtime.handler",
    gatewayHandler(["message"], (event) => {
      if (event.subtype !== "message_deleted" || !event.channel || !isChannelId(event.channel))
        return;
      if (!store.isChannelUnread(event.channel)) return;
      refreshSoon(DELETION_REFRESH_MS);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["badge_counts_updated"], (event) => {
      console.log("DEBUG-BADGE", JSON.stringify(parseBadgeCounts(event)));
      for (const [id, { unread, mentions }] of Object.entries(parseBadgeCounts(event))) {
        if (!isChannelId(id)) continue;
        touched(id);
        store.setUnreadChannelIds(id, unread);
        if (isDmId(id, (dmId) => !!dms.dmById(dmId))) dms.patchDm(id, { mentions });
        else channels.patchChannel(id, { mentions });
      }
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["channel_marked", "group_marked", "im_marked", "mpim_marked"], (event) => {
      if (!(event.channel && event.ts && isChannelId(event.channel) && isTs(event.ts))) return;
      console.log(
        "DEBUG-MARKED",
        JSON.stringify(event),
        store.isStaleReadEcho(event.channel, event.ts),
      );
      if (store.isStaleReadEcho(event.channel, event.ts)) return;
      touched(event.channel);
      const isDm = isDmId(event.channel, (dmId) => !!dms.dmById(dmId));
      const { unread, mentions } = parseCountGroup({ id: event.channel, ...event }, isDm) ?? {
        mentions: 0,
        unread: false,
      };
      store.setUnreadChannelIds(event.channel, unread);
      if (isDm) dms.patchDm(event.channel, { mentions });
      else channels.patchChannel(event.channel, { mentions });
      const readTs = Number(event.ts) * 1000;
      if (Number.isFinite(readTs)) store.setLastReadByChannel(event.channel, readTs);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["thread_marked"], (event) => {
      if (event.thread_ts && event.last_read && isTs(event.thread_ts) && isTs(event.last_read))
        store.setThreadReadTs(event.thread_ts, event.last_read);
    }),
  );
};

export default setup;
