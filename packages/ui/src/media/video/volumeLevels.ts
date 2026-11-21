export interface VolumeState {
  muted: boolean;
  volume: number;
}

export function volumeAfterSet(requested: number, max: number): VolumeState {
  const volume = Math.min(max, Math.max(0, requested));
  return { muted: volume === 0, volume };
}

export function volumeAfterMute(current: VolumeState, muted: boolean): VolumeState {
  return { muted, volume: !muted && current.volume === 0 ? 1 : current.volume };
}

export function mediaLevels(volume: number) {
  return { boosted: volume > 1, elementVolume: Math.min(volume, 1), gain: Math.max(volume, 1) };
}
