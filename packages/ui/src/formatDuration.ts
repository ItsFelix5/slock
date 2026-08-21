export function formatDuration(seconds: number | undefined): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds ?? 0)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
