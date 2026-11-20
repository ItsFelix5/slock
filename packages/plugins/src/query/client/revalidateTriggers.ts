const STALE_HIDDEN_MS = 30_000;

export interface RevalidateTriggers {
  now(): number;
  onRevalidate(): void;
}

/** Wires refetch-on-reconnect and refetch-on-return-after-a-while. Returns the teardown. */
export function installRevalidateTriggers({ now, onRevalidate }: RevalidateTriggers): () => void {
  let hiddenAt: number | null = null;
  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = now();
      return;
    }
    const wasStale = hiddenAt !== null && now() - hiddenAt > STALE_HIDDEN_MS;
    hiddenAt = null;
    if (wasStale) onRevalidate();
  };
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", onRevalidate);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("online", onRevalidate);
  };
}
