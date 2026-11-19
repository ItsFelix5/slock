import { useSeekShortcuts } from "../../hooks/useNavShortcuts";
import { inside, useShortcut } from "../../hooks/useShortcut";

const ACTIVATES_ON_SPACE = "button, a, input";

export function useVideoShortcuts(deps: {
  currentTime: () => number;
  duration: () => number;
  root: () => HTMLElement | undefined;
  seekRoot: () => HTMLElement | undefined;
  seekTo: (ratio: number) => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  togglePlayback: () => void;
}) {
  const inPlayer = inside(deps.root);
  const playerShortcut = {
    allowInInputs: false,
    scope: "general",
    group: "Media",
    target: inPlayer,
  } as const;
  useShortcut({
    ...playerShortcut,
    combo: { key: [" ", "k"] },
    handler: deps.togglePlayback,
    id: "video.playPause",
    label: "Play or pause the video",
    target: (element) => inPlayer(element) && !element.closest(ACTIVATES_ON_SPACE),
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
    root: deps.seekRoot,
    seekTo: deps.seekTo,
  });
}
