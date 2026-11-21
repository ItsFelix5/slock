import { assertNever } from "@slock/core";
import type { ChannelId, Ts } from "@slock/types";

export type ReadSyncState = {
  epochs: ReadonlyMap<ChannelId, number>;
  failures: ReadonlyMap<ChannelId, Ts>;
  pending: ReadonlyMap<ChannelId, number>;
};

export type ReadSyncEvent =
  | { type: "requested"; channelId: ChannelId }
  | { type: "settled"; channelId: ChannelId; epoch: number; ts: Ts; synced: boolean };

export const initialReadSyncState: ReadSyncState = {
  epochs: new Map(),
  failures: new Map(),
  pending: new Map(),
};

export const epochOf = (state: ReadSyncState, channelId: ChannelId): number =>
  state.epochs.get(channelId) ?? 0;

function withEntry<V>(map: ReadonlyMap<ChannelId, V>, channelId: ChannelId, value: V) {
  return new Map(map).set(channelId, value);
}

function withoutEntry<V>(map: ReadonlyMap<ChannelId, V>, channelId: ChannelId) {
  const next = new Map(map);
  next.delete(channelId);
  return next;
}

function finishOne(pending: ReadonlyMap<ChannelId, number>, channelId: ChannelId) {
  const remaining = (pending.get(channelId) ?? 1) - 1;
  return remaining > 0
    ? withEntry(pending, channelId, remaining)
    : withoutEntry(pending, channelId);
}

export function reduceReadSync(state: ReadSyncState, event: ReadSyncEvent): ReadSyncState {
  switch (event.type) {
    case "requested":
      return {
        ...state,
        epochs: withEntry(state.epochs, event.channelId, epochOf(state, event.channelId) + 1),
        pending: withEntry(
          state.pending,
          event.channelId,
          (state.pending.get(event.channelId) ?? 0) + 1,
        ),
      };
    case "settled": {
      const pending = finishOne(state.pending, event.channelId);
      if (epochOf(state, event.channelId) !== event.epoch) return { ...state, pending };
      return {
        ...state,
        failures: event.synced
          ? withoutEntry(state.failures, event.channelId)
          : withEntry(state.failures, event.channelId, event.ts),
        pending,
      };
    }
    default:
      return assertNever(event);
  }
}
