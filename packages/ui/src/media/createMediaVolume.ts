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
  const [muted, setMuted] = createSignal(false);
  const [volume, setVolume] = createSignal(1);

  const disconnectAudioContext = () => {
    gainNode?.disconnect();
    gainNode = undefined;
    void audioContext?.close();
    audioContext = undefined;
  };

  const applyVolume = () => {
    if (!mediaElement) return;
    const value = volume();
    if (value > 1 && !gainNode) {
      audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      audioContext
        .createMediaElementSource(mediaElement)
        .connect(gainNode)
        .connect(audioContext.destination);
    }
    mediaElement.volume = Math.min(value, 1);
    mediaElement.muted = muted();
    if (gainNode) {
      gainNode.gain.value = Math.max(value, 1);
      void audioContext?.resume();
    }
  };

  createEffect(() => {
    const nextMediaElement = media();
    if (nextMediaElement === mediaElement) return;
    disconnectAudioContext();
    mediaElement = nextMediaElement;
    applyVolume();
  });

  onCleanup(disconnectAudioContext);

  return {
    muted,
    setMuted: (nextMuted) => {
      if (!nextMuted && volume() === 0) setVolume(1);
      setMuted(nextMuted);
      applyVolume();
    },
    setVolume: (nextVolume) => {
      const value = Math.min(maxVolume, Math.max(0, nextVolume));
      setVolume(value);
      setMuted(value === 0);
      applyVolume();
    },
    volume,
  };
}
