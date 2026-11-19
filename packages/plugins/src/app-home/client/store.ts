import type { ChannelId } from "@slock/types";
import { createSignal } from "solid-js";

export function createAppHomeStore() {
  const [homeChannelId, setHomeChannelId] = createSignal<ChannelId>();
  return {
    closeHome: () => setHomeChannelId(undefined),
    homeChannelId,
    openHome: setHomeChannelId,
  };
}
