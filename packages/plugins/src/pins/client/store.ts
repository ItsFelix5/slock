import { service } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { PinnedMessage } from "@slock/types";
import { createStore, produce } from "solid-js";
import { defineQuery } from "../../query/client/api";
import { fetchPinnedMessages, fetchPins, togglePin } from "../../slack/client/api";

const feedback = service("feedback");

const pins = defineQuery<string, Record<string, boolean>>({
  load: async (channelId) => {
    const map: Record<string, boolean> = {};
    for (const ts of await fetchPins(channelId)) map[ts] = true;
    return map;
  },
  name: "pins",
});

const pinnedMessages = defineQuery<string, PinnedMessage[]>({
  load: fetchPinnedMessages,
  name: "pinnedMessages",
});

export function createPinnedSlice(deps: {
  panes: Pick<Services["shell.panes"], "closePane" | "openInNewPane" | "panes">;
}) {
  const [pinPending, setPinPending] = createStore<Record<string, boolean>>({});

  const pinPendingKey = (channelId: string, ts: string) => `${channelId}:${ts}`;

  function isPinPending(channelId: string, ts: string): boolean {
    return !!pinPending[pinPendingKey(channelId, ts)];
  }

  function ensurePinsLoaded(channelId: string): void {
    void pins.ensure(channelId).catch(() => {});
  }

  function isMessagePinned(channelId: string, ts: string): boolean {
    return !!pins.peek(channelId)?.[ts];
  }

  async function togglePinMessage(channelId: string, ts: string): Promise<boolean> {
    const pendingKey = pinPendingKey(channelId, ts);
    if (pinPending[pendingKey]) return false;
    setPinPending(pendingKey, true);
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
      if (pinnedMessages.peek(channelId)) pinnedMessages.invalidate(channelId);
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
    await pinnedMessages.refresh(channelId).catch(() => {});
  }

  function applyPinEvent(channelId: string, ts: string, pinned: boolean): void {
    if (pins.peek(channelId)) pins.set(channelId, { ...pins.peek(channelId), [ts]: pinned });
    if (pinnedMessages.peek(channelId)) pinnedMessages.invalidate(channelId);
  }

  function pinnedMessagesFor(channelId: string) {
    return pinnedMessages.peek(channelId);
  }

  function isPinnedMessagesLoading(channelId: string): boolean {
    const { status } = pinnedMessages.entry(channelId);
    return status === "idle" || status === "loading";
  }

  function hasPinnedMessagesError(channelId: string): boolean {
    return pinnedMessages.entry(channelId).status === "error";
  }

  function openPinnedPane(channelId: string) {
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
