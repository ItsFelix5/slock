import { createSignal } from "solid-js";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "slock-theme";

function initial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "system" ? saved : "dark";
}

const [theme, setThemeSignal] = createSignal<Theme>(initial());

const systemQuery = window.matchMedia?.("(prefers-color-scheme: light)");

function resolve(t: Theme): "dark" | "light" {
  return t === "system" ? (systemQuery?.matches ? "light" : "dark") : t;
}

function apply(t: Theme) {
  document.documentElement.classList.toggle("theme-light", resolve(t) === "light");
}
apply(theme());

// Live-follow the OS theme while "system" is selected, instead of only
// resolving it once at load.
systemQuery?.addEventListener("change", () => {
  if (theme() === "system") apply("system");
});

export function setTheme(t: Theme) {
  setThemeSignal(t);
  localStorage.setItem(STORAGE_KEY, t);
  apply(t);
}

const COMPACT_KEY = "slock-compact";
const [compactMode, setCompactModeSignal] = createSignal(localStorage.getItem(COMPACT_KEY) === "1");

function applyCompact(on: boolean) {
  document.documentElement.classList.toggle("compact-mode", on);
}
applyCompact(compactMode());

export function setCompactMode(on: boolean) {
  setCompactModeSignal(on);
  localStorage.setItem(COMPACT_KEY, on ? "1" : "0");
  applyCompact(on);
}

export { compactMode, theme };
