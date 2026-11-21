import { isChannelId } from "@slock/slack";
import type { ChannelId } from "@slock/types";
import { createStore, untrack } from "solid-js";

export function createChannelFlags() {
  const [flags, setFlags] = createStore<Record<ChannelId, boolean>>({});
  const [pending, setPending] = createStore<Record<ChannelId, boolean>>({});

  const idsIn = (record: Record<ChannelId, boolean>) => Object.keys(record).filter(isChannelId);

  function enabledIds(): ChannelId[] {
    return idsIn(flags).filter((id) => flags[id]);
  }

  function enabledIdsWith(channelId: ChannelId, enabled: boolean): ChannelId[] {
    const others = enabledIds().filter((id) => id !== channelId);
    return enabled ? [...others, channelId] : others;
  }

  return {
    enabledIds,
    enabledIdsWith,
    isEnabled: (channelId: ChannelId) => !!flags[channelId],
    isPending: (channelId: ChannelId) => !!pending[channelId],
    begin(channelId: ChannelId, enabled: boolean) {
      setFlags((draft) => {
        draft[channelId] = enabled;
      });
      setPending((draft) => {
        draft[channelId] = true;
      });
    },
    set(channelId: ChannelId, enabled: boolean) {
      setFlags((draft) => {
        draft[channelId] = enabled;
      });
    },
    settle(channelId: ChannelId) {
      setPending((draft) => {
        draft[channelId] = false;
      });
    },
    settleAll() {
      setPending((draft) => {
        for (const id of idsIn(draft)) draft[id] = false;
      });
    },
    sync(ids: ChannelId[], options: { respectPending: boolean }) {
      const wanted = new Set(ids);
      const held = new Set(
        options.respectPending ? untrack(() => idsIn(pending).filter((id) => pending[id])) : [],
      );
      setFlags((draft) => {
        for (const id of new Set([...idsIn(draft), ...wanted])) {
          if (held.has(id)) continue;
          draft[id] = wanted.has(id);
        }
      });
    },
  };
}
