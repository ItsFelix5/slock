import { isChannelId } from "@slock/slack";
import type { ChannelId } from "@slock/types";
import { createStore } from "solid-js";

export function createChannelFlags() {
  const [flags, setFlags] = createStore<Record<string, boolean>>({});
  const [pending, setPending] = createStore<Record<string, boolean>>({});

  function enabledIds(): ChannelId[] {
    return Object.keys(flags).flatMap((id) => (flags[id] && isChannelId(id) ? [id] : []));
  }

  function enabledIdsWith(channelId: ChannelId, enabled: boolean): ChannelId[] {
    const others = enabledIds().filter((id) => id !== channelId);
    return enabled ? [...others, channelId] : others;
  }

  return {
    enabledIds,
    enabledIdsWith,
    isEnabled: (channelId: string) => !!flags[channelId],
    isPending: (channelId: string) => !!pending[channelId],
    begin(channelId: string, enabled: boolean) {
      setFlags((draft) => {
        draft[channelId] = enabled;
      });
      setPending((draft) => {
        draft[channelId] = true;
      });
    },
    set(channelId: string, enabled: boolean) {
      setFlags((draft) => {
        draft[channelId] = enabled;
      });
    },
    settle(channelId: string) {
      setPending((draft) => {
        draft[channelId] = false;
      });
    },
    settleAll() {
      setPending((draft) => {
        for (const id of Object.keys(draft)) draft[id] = false;
      });
    },
    sync(ids: ChannelId[], options: { respectPending: boolean }) {
      const wanted = new Set<string>(ids);
      setFlags((draft) => {
        for (const id of new Set([...Object.keys(draft), ...wanted])) {
          if (options.respectPending && pending[id]) continue;
          draft[id] = wanted.has(id);
        }
      });
    },
  };
}
