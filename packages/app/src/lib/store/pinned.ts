import { fetchPinnedMessages, fetchPins, type PinnedMessage, togglePin } from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "./feedback";

export function createPinnedSlice() {
  const [pinnedByChannel, setPinnedByChannel] = createStore<
    Record<string, Record<string, boolean>>
  >({});
  const loadedPins = new Set<string>();
  const [pinnedMessagesCache, setPinnedMessagesCache] = createStore<
    Record<string, PinnedMessage[]>
  >({});
  const [pinnedPanelChannelId, setPinnedPanelChannelId] = createSignal<string | null>(null);

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

  async function togglePinMessage(channelId: string, ts: string) {
    const currentlyPinned = isMessagePinned(channelId, ts);
    if (!pinnedByChannel[channelId]) setPinnedByChannel(channelId, {});
    setPinnedByChannel(channelId, ts, !currentlyPinned);
    try {
      await togglePin(channelId, ts, currentlyPinned);
    } catch (err) {
      console.error("Failed to toggle pin", err);
      actionFeedback.flash(ts, "Failed to update pin.", "error");
      setPinnedByChannel(channelId, ts, currentlyPinned);
    }
  }

  async function ensurePinnedMessagesLoaded(channelId: string) {
    try {
      const pins = await fetchPinnedMessages(channelId);
      setPinnedMessagesCache(channelId, pins);
    } catch {
      setPinnedMessagesCache(channelId, []);
    }
  }

  function openPinnedPanel(channelId: string) {
    setPinnedPanelChannelId(channelId);
    ensurePinnedMessagesLoaded(channelId);
  }

  function closePinnedPanel() {
    setPinnedPanelChannelId(null);
  }

  return {
    ensurePinsLoaded,
    isMessagePinned,
    togglePinMessage,
    pinnedPanelChannelId,
    pinnedMessagesCache,
    openPinnedPanel,
    closePinnedPanel,
  };
}
