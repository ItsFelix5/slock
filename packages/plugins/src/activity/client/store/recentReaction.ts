import { createSignal, onCleanup } from "solid-js";

const FLASH_DURATION_MS = 1000;

export function createRecentReactionFlash() {
  const [recentReactionEmoji, setRecentReactionEmoji] = createSignal<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  function flash(name: string) {
    clearTimeout(timer);
    setRecentReactionEmoji(name);
    timer = setTimeout(() => setRecentReactionEmoji(undefined), FLASH_DURATION_MS);
  }

  return { flash, recentReactionEmoji };
}
