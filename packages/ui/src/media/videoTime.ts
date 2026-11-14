const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export function formatDuration(seconds: number | undefined): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds ?? 0)) : 0;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = String(total % SECONDS_PER_MINUTE).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

export function clampRatio(ratio: number): number {
  return Number.isNaN(ratio) ? 0 : Math.min(1, Math.max(0, ratio));
}

export function ratioOf(value: number, total: number): number {
  return total > 0 ? clampRatio(value / total) : 0;
}

export function ratioFromPointer(clientX: number, track: { left: number; width: number }): number {
  return clampRatio((clientX - track.left) / track.width);
}

export function timeFromRatio(ratio: number, duration: number): number | undefined {
  return duration > 0 ? clampRatio(ratio) * duration : undefined;
}
