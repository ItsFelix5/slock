import { service } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import type { ChannelId, PinnedMessage, Ts } from "@slock/types";
import { fetchPins, togglePin } from "./requests";

const feedback = service("feedback");

const pins = defineQuery<ChannelId, PinnedMessage[]>({
  load: (channelId, { signal }) => fetchPins(channelId, signal),
  name: "pins",
});

function withPin(ts: Ts, pinned: boolean) {
  return (list: PinnedMessage[]) => {
    if (list.some((pin) => pin.ts === ts) === pinned) return list;
    return pinned ? [...list, { message: null, ts }] : list.filter((pin) => pin.ts !== ts);
  };
}

type PinWrite = { channelId: ChannelId; pinned: boolean; ts: Ts };

export function createPinnedSlice(deps: { panes: Pick<Services["shell.panes"], "openInNewPane"> }) {
  const pinKey = (channelId: ChannelId, ts: Ts) => `${channelId}:${ts}`;

  function seedPinCount(channelId: ChannelId, pinCount: number | undefined): void {
    if (pinCount !== 0) void pins.ensure(channelId).catch(() => {});
    else if (!pins.read(channelId)) pins.set(channelId, []);
  }

  const isMessagePinned = (channelId: ChannelId, ts: Ts) =>
    !!pins.peek(channelId)?.some((pin) => pin.ts === ts);

  const toggling = defineMutation<PinWrite, unknown>({
    key: ({ channelId, ts }) => pinKey(channelId, ts),
    mode: "single",
    onError: (error, { ts }) => {
      console.error("Failed to toggle pin", error);
      feedback.error(ts, "Failed to update pin.");
    },
    onSuccess: (_reply, { channelId, pinned, ts }) =>
      feedback.undo.push({
        label: pinned ? "pin message" : "unpin message",
        undo: () => void togglePinMessage(channelId, ts),
      }),
    optimistic: ({ channelId, pinned, ts }, transaction) =>
      transaction.apply(pins, channelId, withPin(ts, pinned)),
    run: ({ channelId, pinned, ts }) => togglePin(channelId, ts, !pinned),
  });

  function togglePinMessage(channelId: ChannelId, ts: Ts): Promise<boolean> {
    return toggling.run({ channelId, pinned: !isMessagePinned(channelId, ts), ts });
  }

  async function refreshPinnedMessages(channelId: ChannelId): Promise<void> {
    await pins.refresh(channelId).catch(() => {});
  }

  function applyPinEvent(channelId: ChannelId, ts: Ts, pinned: boolean): void {
    pins.modify(channelId, withPin(ts, pinned));
    if (pins.read(channelId)) pins.invalidate(channelId);
  }

  const pinnedMessagesFor = (channelId: ChannelId) =>
    pins.peek(channelId)?.filter((pin) => pin.message);

  function isPinnedMessagesLoading(channelId: ChannelId): boolean {
    const { refreshing, status } = pins.entry(channelId);
    return status === "idle" || refreshing;
  }

  function hasPinnedMessagesError(channelId: ChannelId): boolean {
    return pins.entry(channelId).status === "error";
  }

  function openPinnedPane(channelId: ChannelId) {
    deps.panes.openInNewPane({ channelId, kind: "pinned" });
  }

  return {
    applyPinEvent,
    hasPinnedMessagesError,
    isMessagePinned,
    isPinnedMessagesLoading,
    isPinPending: (channelId: ChannelId, ts: Ts) => toggling.pending(pinKey(channelId, ts)),
    openPinnedPane,
    pinnedMessagesFor,
    refreshPinnedMessages,
    seedPinCount,
    togglePinMessage,
  };
}
