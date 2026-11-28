import { useSeekShortcuts } from "../../hooks/useNavShortcuts";
import { inside, useShortcut } from "../../hooks/useShortcut";
import { VIDEO_SHORTCUTS } from "../mediaShortcuts";

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
  const playerShortcut = { allowInInputs: false, target: inPlayer };
  useShortcut({
    ...playerShortcut,
    ...VIDEO_SHORTCUTS.playPause,
    handler: deps.togglePlayback,
    target: (element) => inPlayer(element) && !element.closest(ACTIVATES_ON_SPACE),
  });
  useShortcut({
    ...playerShortcut,
    ...VIDEO_SHORTCUTS.mute,
    handler: deps.toggleMute,
  });
  useShortcut({
    ...playerShortcut,
    ...VIDEO_SHORTCUTS.fullscreen,
    handler: deps.toggleFullscreen,
  });
  useSeekShortcuts({
    currentTime: deps.currentTime,
    duration: deps.duration,
    root: deps.seekRoot,
    seekTo: deps.seekTo,
  });
}
