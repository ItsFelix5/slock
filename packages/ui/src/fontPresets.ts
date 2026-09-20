import { effectiveFont } from "./font";

export interface FontPreset {
  id: string;
  label: string;
  value: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: "lato", label: "Lato", value: '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  {
    id: "atkinson-hyperlegible-next",
    label: "Atkinson Hyperlegible Next",
    value: '"Atkinson Hyperlegible Next", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    id: "system",
    label: "System UI",
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  { id: "georgia", label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  {
    id: "mono",
    label: "Monospace",
    value: '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
  },
  { id: "comic-sans", label: "Comic Sans", value: '"Comic Sans MS", "Comic Neue", cursive' },
  {
    id: "opendyslexic",
    label: "OpenDyslexic",
    value: '"OpenDyslexic", "Comic Sans MS", sans-serif',
  },
];

export function activeFontPreset(): string {
  const current = effectiveFont().toLowerCase();
  return FONT_PRESETS.find((p) => p.value.toLowerCase() === current)?.id ?? "custom";
}
