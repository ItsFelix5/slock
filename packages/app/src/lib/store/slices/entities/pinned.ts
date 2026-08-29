import { createStore, produce } from "solid-js/store";
import { fetchPinnedMessages, fetchPins, type PinnedMessage, togglePin } from "../../../api";
import { actionFeedback } from "../../../feedback";
import { undoStack } from "../../../undo";
import type { createPanesSlice } from "../session/panes";

export function createPinnedSlice(deps: {
  panes: Pick<ReturnType<typeof createPanesSlice>, "closePane" | "openInNewPane" | "panes">;
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
      undoStack.push({
        label: currentlyPinned ? "unpin message" : "pin message",
        undo: () => void togglePinMessage(channelId, ts),
      });
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

  function pinnedMessagesFor(channelId: string) {
    return pinnedMessagesCache[channelId];
  }

  function isPinnedMessagesLoading(channelId: string): boolean {
    return !!pinnedMessagesLoading[channelId];
  }

  function hasPinnedMessagesError(channelId: string): boolean {
    return !!pinnedMessagesError[channelId];
  }

  function openPinnedPanel(channelId: string) {
    deps.panes.openInNewPane({ channelId, kind: "pinned" });
    refreshPinnedMessages(channelId);
  }

  function closePinnedPanel() {
    const pane = deps.panes.panes().find((p) => p.content?.kind === "pinned");
    if (pane) deps.panes.closePane(pane.id);
  }

  return {
    closePinnedPanel,
    ensurePinsLoaded,
    hasPinnedMessagesError,
    isMessagePinned,
    isPinnedMessagesLoading,
    isPinPending,
    openPinnedPanel,
    pinnedMessagesFor,
    refreshPinnedMessages,
    togglePinMessage,
  };
}
