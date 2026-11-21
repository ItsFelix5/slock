const STALE_HIDDEN_MS = 30_000;
const MIN_GAP_MS = 5_000;

export interface RevalidateTriggers {
  now(): number;
  onRevalidate(): void;
}

export interface InstalledTriggers {
  dispose(): void;
  trigger(): void;
}

export function installRevalidateTriggers({
  now,
  onRevalidate,
}: RevalidateTriggers): InstalledTriggers {
  let hiddenAt: number | null = null;
  let lastAt = Number.NEGATIVE_INFINITY;
  const trigger = () => {
    if (now() - lastAt < MIN_GAP_MS) return;
    lastAt = now();
    onRevalidate();
  };
  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = now();
      return;
    }
    const wasStale = hiddenAt !== null && now() - hiddenAt > STALE_HIDDEN_MS;
    hiddenAt = null;
    if (wasStale) trigger();
  };
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", trigger);
  return {
    dispose: () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", trigger);
    },
    trigger,
  };
}
