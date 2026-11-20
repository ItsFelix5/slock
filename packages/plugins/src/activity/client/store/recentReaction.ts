import type { Env, TimerHandle } from "@slock/core";
import { createSignal, onCleanup } from "solid-js";

const FLASH_DURATION_MS = 1000;

export function createRecentReactionFlash(env: Env) {
  const [recentReactionEmoji, setRecentReactionEmoji] = createSignal<string>();
  let timer: TimerHandle | undefined;
  onCleanup(() => env.clearTimeout(timer));

  function flash(name: string) {
    env.clearTimeout(timer);
    setRecentReactionEmoji(name);
    timer = env.setTimeout(() => setRecentReactionEmoji(undefined), FLASH_DURATION_MS);
  }

  return { flash, recentReactionEmoji };
}
