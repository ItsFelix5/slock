import { createReactiveQueryCache } from "../../../reactiveQueryCache";
import { queryOptions } from "@tanstack/solid-query";
import { createStore, produce } from "solid-js/store";
import { fetchPinnedMessages, fetchPins, type PinnedMessage, togglePin } from "../../../api";
import { flashError, undoStack } from "../../../feedback";
import { queryClient } from "../../../queryClient";
import type { createPanesSlice } from "../session/panes";

export function pinsQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["pins", channelId],
    queryFn: async () => {
      const pins = await fetchPins(channelId);
      const map: Record<string, boolean> = {};
      for (const ts of pins) map[ts] = true;
      return map;
    },
  });
}

export function pinnedMessagesQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["pinnedMessages", channelId],
    queryFn: () => fetchPinnedMessages(channelId),
  });
}

export function createPinnedSlice(deps: {
  panes: Pick<ReturnType<typeof createPanesSlice>, "closePane" | "openInNewPane" | "panes">;
}) {
  const pins = createReactiveQueryCache<Record<string, boolean>>(
    queryClient,
    "pins",
    pinsQueryOptions,
  );
  const pinnedMessages = createReactiveQueryCache<PinnedMessage[]>(
    queryClient,
    "pinnedMessages",
    pinnedMessagesQueryOptions,
  );
  const [pinPending, setPinPending] = createStore<Record<string, boolean>>({});

  const pinPendingKey = (channelId: string, ts: string) => `${channelId}:${ts}`;

  function isPinPending(channelId: string, ts: string): boolean {
    return !!pinPending[pinPendingKey(channelId, ts)];
  }

  function ensurePinsLoaded(channelId: string): void {
    pins.ensure(channelId);
  }

  function isMessagePinned(channelId: string, ts: string): boolean {
    return !!pins.entry(channelId)?.[ts];
  }

  async function togglePinMessage(channelId: string, ts: string): Promise<boolean> {
    const pendingKey = pinPendingKey(channelId, ts);
    if (pinPending[pendingKey]) return false;
    setPinPending(pendingKey, true);
    const currentlyPinned = isMessagePinned(channelId, ts);
    pins.set(channelId, { ...pins.entry(channelId), [ts]: !currentlyPinned });
    if (currentlyPinned && pinnedMessages.entry(channelId)) {
      pinnedMessages.set(
        channelId,
        (pinnedMessages.entry(channelId) ?? []).filter((p) => p.ts !== ts),
      );
    }
    try {
      await togglePin(channelId, ts, currentlyPinned);
      undoStack.push({
        label: currentlyPinned ? "unpin message" : "pin message",
        undo: () => void togglePinMessage(channelId, ts),
      });
      return true;
    } catch (err) {
      console.error("Failed to toggle pin", err);
      flashError(ts, "Failed to update pin.");
      pins.set(channelId, { ...pins.entry(channelId), [ts]: currentlyPinned });
      if (pinnedMessages.entry(channelId)) pinnedMessages.invalidate(channelId);
      return false;
    } finally {
      setPinPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  async function refreshPinnedMessages(channelId: string): Promise<void> {
    await queryClient.refetchQueries({ queryKey: ["pinnedMessages", channelId] });
  }

  function applyPinEvent(channelId: string, ts: string, pinned: boolean): void {
    if (pins.entry(channelId)) pins.set(channelId, { ...pins.entry(channelId), [ts]: pinned });
    if (pinnedMessages.entry(channelId)) pinnedMessages.invalidate(channelId);
  }

  function pinnedMessagesFor(channelId: string) {
    return pinnedMessages.entry(channelId);
  }

  function isPinnedMessagesLoading(channelId: string): boolean {
    return pinnedMessages.isLoading(channelId);
  }

  function hasPinnedMessagesError(channelId: string): boolean {
    return pinnedMessages.hasError(channelId);
  }

  function openPinnedPanel(channelId: string) {
    deps.panes.openInNewPane({ channelId, kind: "pinned" });
  }

  function closePinnedPanel() {
    const pane = deps.panes.panes().find((p) => p.content?.kind === "pinned");
    if (pane) deps.panes.closePane(pane.id);
  }

  return {
    applyPinEvent,
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
