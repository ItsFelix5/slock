import { createFlags, service } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { ChannelId, PinnedMessage, Ts } from "@slock/types";
import { defineQuery } from "../../query/client/api";
import { fetchPinnedMessages, fetchPins, togglePin } from "../../slack/client/api";

const feedback = service("feedback");

const pins = defineQuery<ChannelId, Record<Ts, boolean>>({
  load: async (channelId) => {
    const map: Record<Ts, boolean> = {};
    for (const ts of await fetchPins(channelId)) map[ts] = true;
    return map;
  },
  name: "pins",
});

const pinnedMessages = defineQuery<ChannelId, PinnedMessage[]>({
  load: fetchPinnedMessages,
  name: "pinnedMessages",
});

export function createPinnedSlice(deps: {
  panes: Pick<Services["shell.panes"], "closePane" | "openInNewPane" | "panes">;
}) {
  const pinPending = createFlags<string>();

  const pinPendingKey = (channelId: ChannelId, ts: Ts) => `${channelId}:${ts}`;

  const isPinPending = (channelId: ChannelId, ts: Ts) =>
    pinPending.has(pinPendingKey(channelId, ts));

  function ensurePinsLoaded(channelId: ChannelId): void {
    void pins.ensure(channelId).catch(() => {});
  }

  function isMessagePinned(channelId: ChannelId, ts: Ts): boolean {
    return !!pins.peek(channelId)?.[ts];
  }

  async function togglePinMessage(channelId: ChannelId, ts: Ts): Promise<boolean> {
    const pendingKey = pinPendingKey(channelId, ts);
    if (pinPending.has(pendingKey)) return false;
    pinPending.set(pendingKey, true);
    const currentlyPinned = isMessagePinned(channelId, ts);
    pins.set(channelId, { ...pins.peek(channelId), [ts]: !currentlyPinned });
    if (currentlyPinned && pinnedMessages.peek(channelId)) {
      pinnedMessages.set(
        channelId,
        (pinnedMessages.peek(channelId) ?? []).filter((p) => p.ts !== ts),
      );
    }
    try {
      await togglePin(channelId, ts, currentlyPinned);
      feedback.undo.push({
        label: currentlyPinned ? "unpin message" : "pin message",
        undo: () => void togglePinMessage(channelId, ts),
      });
      return true;
    } catch (err) {
      console.error("Failed to toggle pin", err);
      feedback.error(ts, "Failed to update pin.");
      pins.set(channelId, { ...pins.peek(channelId), [ts]: currentlyPinned });
      if (pinnedMessages.peek(channelId)) void refreshPinnedMessages(channelId);
      return false;
    } finally {
      pinPending.set(pendingKey, false);
    }
  }

  async function refreshPinnedMessages(channelId: ChannelId): Promise<void> {
    await pinnedMessages.refresh(channelId).catch(() => {});
  }

  function applyPinEvent(channelId: ChannelId, ts: Ts, pinned: boolean): void {
    if (pins.peek(channelId)) pins.set(channelId, { ...pins.peek(channelId), [ts]: pinned });
    if (pinnedMessages.peek(channelId)) void refreshPinnedMessages(channelId);
  }

  function pinnedMessagesFor(channelId: ChannelId) {
    return pinnedMessages.peek(channelId);
  }

  function isPinnedMessagesLoading(channelId: ChannelId): boolean {
    const { status } = pinnedMessages.entry(channelId);
    return status === "idle" || status === "loading";
  }

  function hasPinnedMessagesError(channelId: ChannelId): boolean {
    return pinnedMessages.entry(channelId).status === "error";
  }

  function openPinnedPane(channelId: ChannelId) {
    deps.panes.openInNewPane({ channelId, kind: "pinned" });
  }

  function closePinnedPane() {
    const pane = deps.panes.panes().find((p) => p.content?.kind === "pinned");
    if (pane) deps.panes.closePane(pane.id);
  }

  return {
    applyPinEvent,
    closePinnedPane,
    ensurePinsLoaded,
    hasPinnedMessagesError,
    isMessagePinned,
    isPinnedMessagesLoading,
    isPinPending,
    openPinnedPane,
    pinnedMessagesFor,
    refreshPinnedMessages,
    togglePinMessage,
  };
}
