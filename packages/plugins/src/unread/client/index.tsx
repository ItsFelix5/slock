import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import {
  buildUnreadMap,
  isChannelId,
  isTs,
  parseBadgeCounts,
  parseCountGroup,
} from "@slock/slack";
import { isDmId } from "../../dms/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import { fetchCounts, markChannelRead, markThreadRead } from "../../slack/client/api";
import { createUnreadStore } from "./store";

const feedback = service("feedback");

const REFRESH_AFTER_MS = 5000;
const DELETION_REFRESH_MS = 500;
const READ_REFRESH_MS = 300;

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const channels = service("channels");
  const dms = service("dms");
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  ctx.onCleanup(() => clearTimeout(refreshTimer));
  const refreshSoon = (ms: number) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshCounts(), ms);
  };
  const store = createUnreadStore({
    api: { markChannelRead, markThreadRead },
    bootstrap: () => bootstrap.bootstrap().data,
    flash: (...args) => feedback.flash(...args),
    onReadSynced: () => refreshSoon(READ_REFRESH_MS),
    patchChannel: channels.patchChannel,
    patchDm: dms.patchDm,
  });
  ctx.provide("unread", store);
  const onCounts = ctx.use("unread.counts");
  let lastRefreshAt = 0;
  let refreshSeq = 0;
  let disposed = false;
  ctx.onCleanup(() => {
    disposed = true;
  });
  const refreshCounts = async () => {
    lastRefreshAt = Date.now();
    const seq = ++refreshSeq;
    const data = await fetchCounts().catch(() => undefined);
    if (!data || disposed || seq !== refreshSeq) return;
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
  const refreshWhenBack = () => {
    if (document.visibilityState === "visible" && Date.now() - lastRefreshAt > REFRESH_AFTER_MS)
      void refreshCounts();
  };
  window.addEventListener("focus", refreshWhenBack);
  document.addEventListener("visibilitychange", refreshWhenBack);
  ctx.onCleanup(() => {
    window.removeEventListener("focus", refreshWhenBack);
    document.removeEventListener("visibilitychange", refreshWhenBack);
  });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["badge_counts_updated"], (event) => {
      for (const [id, { unread, mentions }] of Object.entries(parseBadgeCounts(event))) {
        if (!isChannelId(id)) continue;
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
      if (store.isStaleReadEcho(event.channel, event.ts)) return;
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
