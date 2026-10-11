import { useSeekShortcuts } from "../useNavShortcuts";
import { inside, useShortcut } from "../useShortcut";

export function useVideoShortcuts(deps: {
  currentTime: () => number;
  duration: () => number;
  root: () => HTMLElement | undefined;
  seekTo: (ratio: number) => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  togglePlayback: () => void;
}) {
  const playerShortcut = {
    allowInInputs: false,
    scope: "general",
    group: "Media",
    target: inside(deps.root),
  } as const;
  useShortcut({
    ...playerShortcut,
    combo: { key: [" ", "k"] },
    handler: deps.togglePlayback,
    id: "video.playPause",
    label: "Play or pause the video",
  });
  useShortcut({
    ...playerShortcut,
    combo: { key: "m" },
    handler: deps.toggleMute,
    id: "video.mute",
    label: "Mute or unmute the video",
  });
  useShortcut({
    ...playerShortcut,
    combo: { key: "f" },
    handler: deps.toggleFullscreen,
    id: "video.fullscreen",
    label: "Toggle video fullscreen",
  });
  useSeekShortcuts({
    currentTime: deps.currentTime,
    duration: deps.duration,
    root: deps.root,
    seekTo: deps.seekTo,
  });
}
