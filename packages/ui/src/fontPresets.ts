import { getEffectiveColor } from "./themeColors";

export interface FontPreset {
  id: string;
  label: string;
  value: string;
}

export const DEFAULT_FONT = '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const FONT_PRESETS: FontPreset[] = [
  { id: "lato", label: "Lato", value: DEFAULT_FONT },
  {
    id: "system",
    label: "System UI",
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  { id: "georgia", label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Monospace", value: '"SFMono-Regular", Menlo, Consolas, monospace' },
  { id: "comic-sans", label: "Comic Sans", value: '"Comic Sans MS", "Comic Sans", cursive' },
];

export function activeFontPreset(): string {
  const current = getEffectiveColor("font").toLowerCase();
  return FONT_PRESETS.find((p) => p.value.toLowerCase() === current)?.id ?? "custom";
}
