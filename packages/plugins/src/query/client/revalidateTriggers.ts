const STALE_HIDDEN_MS = 30_000;
const MIN_GAP_MS = 5_000;

interface RevalidateTriggers {
  now(): number;
  onRevalidate(): void;
}

export function installRevalidateTriggers({ now, onRevalidate }: RevalidateTriggers): () => void {
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
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("online", trigger);
  };
}
