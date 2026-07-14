export const DEFAULT_WIDTH = 340;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 480;
export const EXPIRATION_OPTIONS = [
  { label: "Don't clear", seconds: 0 },
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "4 hours", seconds: 4 * 60 * 60 },
  { label: "Today", seconds: -1 },
];
export const blurOnEnter = (event: KeyboardEvent) => {
  if (event.key === "Enter") (event.currentTarget as HTMLElement).blur();
};
