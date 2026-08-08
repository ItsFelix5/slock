import { fetchPinnedMessages, fetchPins, type PinnedMessage, togglePin } from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";

export function createPinnedSlice(deps: {
  recordUndoableAction: (label: string, undo: () => void) => void;
}) {
  const [pinnedByChannel, setPinnedByChannel] = createStore<
    Record<string, Record<string, boolean>>
  >({});
  const loadedPins = new Set<string>();
  const [pinnedMessagesCache, setPinnedMessagesCache] = createStore<
    Record<string, PinnedMessage[]>
  >({});
  const [pinnedMessagesError, setPinnedMessagesError] = createStore<Record<string, boolean>>({});
  const [pinnedMessagesLoading, setPinnedMessagesLoading] = createStore<Record<string, boolean>>(
    {},
  );
  const [pinnedPanelChannelId, setPinnedPanelChannelId] = createSignal<string | null>(null);
  const [pinPending, setPinPending] = createStore<Record<string, boolean>>({});

  const pinPendingKey = (channelId: string, ts: string) => `${channelId}:${ts}`;

  function isPinPending(channelId: string, ts: string): boolean {
    return !!pinPending[pinPendingKey(channelId, ts)];
  }

  async function ensurePinsLoaded(channelId: string) {
    if (loadedPins.has(channelId)) return;
    loadedPins.add(channelId);
    try {
      const pins = await fetchPins(channelId);
      const map: Record<string, boolean> = {};
      for (const ts of pins) map[ts] = true;
      setPinnedByChannel(channelId, map);
    } catch {
      loadedPins.delete(channelId);
    }
  }

  function isMessagePinned(channelId: string, ts: string): boolean {
    return !!pinnedByChannel[channelId]?.[ts];
  }

  async function togglePinMessage(channelId: string, ts: string): Promise<boolean> {
    const pendingKey = pinPendingKey(channelId, ts);
    if (pinPending[pendingKey]) return false;
    setPinPending(pendingKey, true);
    const currentlyPinned = isMessagePinned(channelId, ts);
    if (!pinnedByChannel[channelId]) setPinnedByChannel(channelId, {});
    setPinnedByChannel(channelId, ts, !currentlyPinned);
    try {
      await togglePin(channelId, ts, currentlyPinned);
      deps.recordUndoableAction(currentlyPinned ? "Unpinned message" : "Pinned message", () =>
        togglePinMessage(channelId, ts),
      );
      return true;
    } catch (err) {
      console.error("Failed to toggle pin", err);
      actionFeedback.flash(ts, "Failed to update pin.", "error");
      setPinnedByChannel(channelId, ts, currentlyPinned);
      return false;
    } finally {
      setPinPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  async function refreshPinnedMessages(channelId: string) {
    if (pinnedMessagesLoading[channelId]) return;
    setPinnedMessagesLoading(channelId, true);
    setPinnedMessagesError(channelId, false);
    try {
      const pins = await fetchPinnedMessages(channelId);
      setPinnedMessagesCache(channelId, pins);
    } catch (err) {
      console.error("Failed to load pinned messages", err);
      setPinnedMessagesError(channelId, true);
    } finally {
      setPinnedMessagesLoading(channelId, false);
    }
  }

  function openPinnedPanel(channelId: string) {
    setPinnedPanelChannelId(channelId);
    refreshPinnedMessages(channelId);
  }

  function closePinnedPanel() {
    setPinnedPanelChannelId(null);
  }

  return {
    closePinnedPanel,
    ensurePinsLoaded,
    isMessagePinned,
    isPinPending,
    openPinnedPanel,
    pinnedMessagesCache,
    pinnedMessagesError,
    pinnedMessagesLoading,
    pinnedPanelChannelId,
    refreshPinnedMessages,
    togglePinMessage,
  };
}
