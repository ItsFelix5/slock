import type { ChannelId, Ts } from "@slock/types";
import { createSignal } from "solid-js";
import {
  epochOf,
  initialReadSyncState,
  type ReadSyncEvent,
  reduceReadSync,
} from "./activityReadSyncReducer";

export function createActivityReadSync(
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>,
) {
  let state = initialReadSyncState;
  const [view, setView] = createSignal(state);

  function dispatch(event: ReadSyncEvent) {
    state = reduceReadSync(state, event);
    setView(state);
  }

  async function request(channelId: ChannelId, ts: Ts): Promise<boolean> {
    dispatch({ channelId, type: "requested" });
    const epoch = epochOf(state, channelId);
    const synced = await syncChannelRead(channelId, ts).catch(() => false);
    const current = epochOf(state, channelId) === epoch;
    dispatch({ channelId, epoch, synced, ts, type: "settled" });
    return current && synced;
  }

  async function retry(): Promise<void> {
    await Promise.all([...state.failures].map(([channelId, ts]) => request(channelId, ts)));
  }

  return {
    error: () => view().failures.size > 0,
    isPending: () => view().pending.size > 0,
    request,
    retry,
  };
}
