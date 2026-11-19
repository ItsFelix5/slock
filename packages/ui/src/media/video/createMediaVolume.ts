import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";

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
  const current = { muted: false, volume: 1 };
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
    const value = current.volume;
    if (value > 1 && !gainNode) {
      audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      audioContext
        .createMediaElementSource(mediaElement)
        .connect(gainNode)
        .connect(audioContext.destination);
    }
    mediaElement.volume = Math.min(value, 1);
    mediaElement.muted = current.muted;
    if (gainNode) {
      gainNode.gain.value = Math.max(value, 1);
      void audioContext?.resume();
    }
  };

  const update = (nextVolume: number, nextMuted: boolean) => {
    current.volume = nextVolume;
    current.muted = nextMuted;
    setVolumeSignal(nextVolume);
    setMutedSignal(nextMuted);
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
    setMuted: (nextMuted) => {
      update(!nextMuted && current.volume === 0 ? 1 : current.volume, nextMuted);
    },
    setVolume: (nextVolume) => {
      const value = Math.min(maxVolume, Math.max(0, nextVolume));
      update(value, value === 0);
    },
    volume,
  };
}
