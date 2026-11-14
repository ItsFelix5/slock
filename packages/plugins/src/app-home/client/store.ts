import { createSignal } from "solid-js";

export function createAppHomeStore() {
  const [homeChannelId, setHomeChannelId] = createSignal<string>();
  return {
    closeHome: () => setHomeChannelId(undefined),
    homeChannelId,
    openHome: setHomeChannelId,
  };
}
