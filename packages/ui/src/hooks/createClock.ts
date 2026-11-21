import { service } from "@slock/core/solid";
import { createSignal, onCleanup } from "solid-js";

const env = service("env");

export function createClock(intervalMs: number) {
  const [now, setNow] = createSignal(env.now());
  const timer = env.setInterval(() => setNow(env.now()), intervalMs);
  onCleanup(() => env.clearInterval(timer));
  return now;
}
