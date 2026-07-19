import type { Channel, DirectMessage, Message } from "@slock/slack-api";
import { markChannelRead } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "../types";

// client.counts' mention badge is only fetched once at boot (see bootstrap's
// buildUnreadMap) and never refreshed, so left alone it goes stale the moment
// a mention arrives or gets read during the session — keep it in sync locally
// wherever we already tell Slack "read up to here".
export function createUnreadSlice(deps: {
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  bootstrap: () =>
    | {
        channels: Channel[];
        directMessages: DirectMessage[];
        lastReadByChannel: Record<string, number>;
      }
    | undefined;
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
  // the same signal Slack's real unread badges use. Sourced from the same
  // bootstrap client.counts call above rather than a second fetch.
  const [lastReadByChannel, setLastReadByChannel] = createStore<Record<string, number>>({});
  // Where the "new messages" divider line sits — frozen at the read cursor's
  // position from *before* the current visit marks everything read, so it
  // doesn't vanish the instant you open the channel. Reset when you leave so
  // the next visit re-anchors to whatever's unread by then.
  const [unreadDividerTs, setUnreadDividerTs] = createStore<Record<string, number | undefined>>({});

  const [lastReadSeeded, setLastReadSeeded] = createSignal(false);
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || lastReadSeeded()) return;
    setLastReadSeeded(true);
    for (const [id, ts] of Object.entries(data.lastReadByChannel)) setLastReadByChannel(id, ts);
  });

  function clearChannelUnread(channelId: string) {
    setUnreadChannelIds(channelId, false);
    if (channelId.startsWith("D")) deps.patchDm(channelId, { mentions: 0 });
    else deps.patchChannel(channelId, { mentions: 0 });
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
      if (!lastReadSeeded()) return;
      if (dividerAnchoredChannels.has(id)) return;
      // Wait for the channel's own history too — deciding "caught up" below
      // needs the actual last message, not an empty list that hasn't loaded yet.
      const list = readDeps.messagesByChannel[id];
      if (!list?.length) return;
      dividerAnchoredChannels.add(id);
      const lastRead = lastReadByChannel[id] ?? 0;
      const latest = list[list.length - 1];
      // Only anchor a divider when there's a genuine gap (unread messages
      // already sitting there when you opened). Otherwise — already caught
      // up — use a sentinel no message can ever cross, so a message sent or
      // received *during* this visit (including your own) never gets mistaken
      // for "new since last time" and grows a divider above it.
      // lastRead of 0 means Slack has no read cursor at all (channel never
      // opened before) rather than "read nothing yet" — treat that as caught
      // up too, so a first-ever open lands on the newest message instead of
      // backfilling all the way to the channel's start looking for a divider.
      const hasUnreadGap = !!latest && lastRead > 0 && parseFloat(latest.ts) * 1000 > lastRead;
      const anchor = hasUnreadGap ? lastRead : Infinity;
      setUnreadDividerTs(id, anchor);
      if (import.meta.env.DEV) {
        console.debug("[slock unread anchor]", {
          anchor,
          channelId: id,
          firstTs: list[0]?.ts,
          hasUnreadGap,
          lastRead,
          latestTs: latest?.ts,
          messageCount: list.length,
        });
      }
    });

    // Drop the divider anchor for a channel once you leave it, so the next
    // visit re-anchors to whatever's unread by then instead of reusing a stale
    // (now fully-read) position. This clears strictly at leave-time — a moment
    // that never overlaps with the *next* visit's anchor computation — which is
    // what lets the mark-as-read effect below use unreadDividerTs's own
    // undefined/defined state as its gate instead of assuming effect order.
    let previousActiveChannelId: string | undefined;
    createEffect(() => {
      const id = readDeps.activeView()?.id;
      if (previousActiveChannelId && previousActiveChannelId !== id) {
        dividerAnchoredChannels.delete(previousActiveChannelId);
        setUnreadDividerTs(previousActiveChannelId, undefined);
      }
      previousActiveChannelId = id;
    });

    // Advances the *real* Slack read cursor to the latest message of whichever
    // channel/DM is currently open — setActiveView only clears the local
    // unread dot, it never tells Slack itself. Reruns whenever the active
    // channel's message list changes, so this also covers a new message
    // arriving while you're already looking at it (the way the real client
    // keeps a channel "seen" live), not just the initial switch.
    //
    // Gated on unreadDividerTs already being anchored for this visit: Solid
    // doesn't guarantee the anchor effect above runs first just because it was
    // registered first (verified — they can race), and if this effect wins the
    // race it stamps lastReadByChannel with the *current* latest message before
    // the anchor effect reads it, making every message look already-read and
    // permanently hiding the divider. Reading unreadDividerTs here creates a
    // real reactive dependency, so once the anchor effect sets it this effect
    // reruns on its own — no ordering assumption needed.
    const lastMarkedReadTs: Record<string, string> = {};
    createEffect(() => {
      const view = readDeps.activeView();
      if (!view) return;
      if (unreadDividerTs[view.id] === undefined) return;
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
    clearChannelUnread,
    lastReadByChannel,
    setLastReadByChannel,
    setUnreadChannelIds,
    setUnreadDividerTs,
    unreadChannelIds,
    unreadDividerTs,
    unreadDividerTsForChannel,
    wireReadTracking,
  };
}
