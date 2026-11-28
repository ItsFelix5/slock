import type { ShortcutSpec } from "@slock/ui";

const MOD_ARROWS = [
  { direction: "up", key: "ArrowUp" },
  { direction: "down", key: "ArrowDown" },
  { direction: "left", key: "ArrowLeft" },
  { direction: "right", key: "ArrowRight" },
] as const;

export const PICKER_SHORTCUTS = MOD_ARROWS.map(({ direction, key }) => ({
  direction,
  spec: {
    combo: { key, mod: true },
    group: "Lists",
    id: `emojiPicker.${direction}`,
    label: `Emoji picker: move ${direction}`,
    scope: "lists",
  } satisfies ShortcutSpec,
}));
