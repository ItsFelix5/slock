import type { Channel, DirectMessage, Message } from "@slock/slack-api";
import { fetchLastReadByChannel, markChannelRead } from "@slock/slack-api";
import { createEffect, createResource } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "./types";

// client.counts' mention badge is only fetched once at boot (see bootstrap's
// buildUnreadMap) and never refreshed, so left alone it goes stale the moment
// a mention arrives or gets read during the session — keep it in sync locally
// wherever we already tell Slack "read up to here".
export function createUnreadSlice(deps: {
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  bootstrap: () => { channels: Channel[]; directMessages: DirectMessage[] } | undefined;
}) {
  const [unreadChannelIds, setUnreadChannelIds] = createStore<Record<string, boolean>>({});

  // Seed from client.counts (via bootstrap) so a fresh load shows the real
  // unread dots immediately, instead of waiting for a live event to touch
  // each channel/DM.
  let unreadIdsSeeded = false;
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || unreadIdsSeeded) return;
    unreadIdsSeeded = true;
    for (const c of data.channels) if (c.unread) setUnreadChannelIds(c.id, true);
    for (const dm of data.directMessages) if (dm.unread) setUnreadChannelIds(dm.id, true);
  });
  // Per-channel real Slack read cursors (client.counts' last_read) rather than a
  // single locally-invented "activity read at" timestamp — an activity item is
  // unread if its ts is past the *account's own* read cursor for that channel,
  // the same signal Slack's real unread badges use.
  const [lastReadByChannel, setLastReadByChannel] = createStore<Record<string, number>>({});
  const [lastReadByChannelResource] = createResource(fetchLastReadByChannel);
  // Where the "new messages" divider line sits — frozen at the read cursor's
  // position from *before* the current visit marks everything read, so it
  // doesn't vanish the instant you open the channel. Reset when you leave so
  // the next visit re-anchors to whatever's unread by then.
  const [unreadDividerTs, setUnreadDividerTs] = createStore<Record<string, number>>({});

  let lastReadSeeded = false;
  createEffect(() => {
    const data = lastReadByChannelResource();
    if (!data || lastReadSeeded) return;
    lastReadSeeded = true;
    for (const [id, ts] of Object.entries(data)) setLastReadByChannel(id, ts);
  });

  function clearChannelUnread(channelId: string) {
    setUnreadChannelIds(channelId, false);
    deps.patchChannel(channelId, { mentions: 0 });
  }

  function unreadDividerTsForChannel(channelId: string) {
    return unreadDividerTs[channelId];
  }

  // Wires the read-cursor/divider effects that need to watch the active view
  // and the loaded message list — kept here (rather than as a constructor dep)
  // since messages.ts is necessarily built after this slice.
  function wireReadTracking(readDeps: {
    activeView: () => View | null;
    messagesByChannel: Record<string, Message[]>;
  }) {
    // Snapshots where the "new messages" divider sits, once per visit to a
    // channel — keyed only on the active channel id, *not* on the message list,
    // so it re-anchors every time you switch in even if the list hasn't changed
    // (e.g. after using "mark unread", which doesn't add any new message).
    // Must run before the mark-as-read effect below so it captures the cursor's
    // pre-visit value rather than the one that effect is about to write.
    const dividerAnchoredChannels = new Set<string>();
    createEffect(() => {
      const id = readDeps.activeView()?.id;
      if (!id) return;
      // Read cursors haven't arrived yet — anchoring now would treat "unknown"
      // as "read nothing" (0) and plant the divider above the oldest loaded
      // message. Wait, without latching, so this fires for real once loaded.
      if (lastReadByChannelResource.loading) return;
      if (dividerAnchoredChannels.has(id)) return;
      dividerAnchoredChannels.add(id);
      setUnreadDividerTs(id, lastReadByChannel[id] ?? 0);
    });

    // Drop the divider anchor for a channel once you leave it, so the next
    // visit re-anchors to whatever's unread by then instead of reusing a stale
    // (now fully-read) position.
    let previousActiveChannelId: string | undefined;
    createEffect(() => {
      const id = readDeps.activeView()?.id;
      if (previousActiveChannelId && previousActiveChannelId !== id) {
        dividerAnchoredChannels.delete(previousActiveChannelId);
      }
      previousActiveChannelId = id;
    });

    // Advances the *real* Slack read cursor to the latest message of whichever
    // channel/DM is currently open — setActiveView only clears the local
    // unread dot, it never tells Slack itself. Reruns whenever the active
    // channel's message list changes, so this also covers a new message
    // arriving while you're already looking at it (the way the real client
    // keeps a channel "seen" live), not just the initial switch.
    const lastMarkedReadTs: Record<string, string> = {};
    createEffect(() => {
      const view = readDeps.activeView();
      if (!view) return;
      const list = readDeps.messagesByChannel[view.id];
      const latest = list?.[list.length - 1];
      if (!latest || latest.id.startsWith("pending-")) return;
      if (lastMarkedReadTs[view.id] === latest.ts) return;
      lastMarkedReadTs[view.id] = latest.ts;
      clearChannelUnread(view.id);
      setLastReadByChannel(view.id, parseFloat(latest.ts) * 1000);
      markChannelRead(view.id, latest.ts).catch(() => {});
    });
  }

  return {
    unreadChannelIds,
    setUnreadChannelIds,
    lastReadByChannel,
    setLastReadByChannel,
    lastReadByChannelResource,
    unreadDividerTs,
    setUnreadDividerTs,
    clearChannelUnread,
    unreadDividerTsForChannel,
    wireReadTracking,
  };
}
