import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { mediaLevels, type VolumeState, volumeAfterMute, volumeAfterSet } from "./volumeLevels";

export interface MediaVolumeControl {
  muted: Accessor<boolean>;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  volume: Accessor<number>;
}

export function createMediaVolume(
  media: Accessor<HTMLMediaElement | undefined>,
  maxVolume = 5,
): MediaVolumeControl {
  let audioContext: AudioContext | undefined;
  let gainNode: GainNode | undefined;
  let mediaElement: HTMLMediaElement | undefined;
  let current: VolumeState = { muted: false, volume: 1 };
  const [muted, setMutedSignal] = createSignal(current.muted);
  const [volume, setVolumeSignal] = createSignal(current.volume);

  const disconnectAudioContext = () => {
    gainNode?.disconnect();
    gainNode = undefined;
    void audioContext?.close();
    audioContext = undefined;
  };

  const applyVolume = () => {
    if (!mediaElement) return;
    const levels = mediaLevels(current.volume);
    if (levels.boosted && !gainNode) {
      audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      audioContext
        .createMediaElementSource(mediaElement)
        .connect(gainNode)
        .connect(audioContext.destination);
    }
    mediaElement.volume = levels.elementVolume;
    mediaElement.muted = current.muted;
    if (gainNode) {
      gainNode.gain.value = levels.gain;
      void audioContext?.resume();
    }
  };

  const update = (next: VolumeState) => {
    current = next;
    setVolumeSignal(next.volume);
    setMutedSignal(next.muted);
    applyVolume();
  };

  createEffect(media, (nextMediaElement) => {
    disconnectAudioContext();
    mediaElement = nextMediaElement;
    applyVolume();
  });

  onCleanup(disconnectAudioContext);

  return {
    muted,
    setMuted: (nextMuted) => update(volumeAfterMute(current, nextMuted)),
    setVolume: (nextVolume) => update(volumeAfterSet(nextVolume, maxVolume)),
    volume,
  };
}
