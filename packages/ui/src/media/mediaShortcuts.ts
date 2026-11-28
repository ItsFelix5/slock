import type { ShortcutSpec } from "../hooks/shortcutRegistry";

const video = { scope: "general", group: "Media" } as const;

export const VIDEO_SHORTCUTS = {
  playPause: {
    ...video,
    combo: { key: [" ", "k"] },
    id: "video.playPause",
    label: "Play or pause the video",
  },
  mute: { ...video, combo: { key: "m" }, id: "video.mute", label: "Mute or unmute the video" },
  fullscreen: {
    ...video,
    combo: { key: "f" },
    id: "video.fullscreen",
    label: "Toggle video fullscreen",
  },
} satisfies Record<string, ShortcutSpec>;

export const LENS_SHORTCUTS = {
  zoomIn: {
    ...video,
    combo: { key: ["=", "+"] },
    id: "lens.zoomIn",
    label: "Zoom the magnifier in",
  },
  zoomOut: { ...video, combo: { key: "-" }, id: "lens.zoomOut", label: "Zoom the magnifier out" },
} satisfies Record<string, ShortcutSpec>;
