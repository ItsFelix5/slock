import { createSignal } from 'solid-js';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'slock-theme';

function initial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

const [theme, setThemeSignal] = createSignal<Theme>(initial());

function apply(t: Theme) {
  document.documentElement.classList.toggle('theme-light', t === 'light');
}
apply(theme());

export function setTheme(t: Theme) {
  setThemeSignal(t);
  localStorage.setItem(STORAGE_KEY, t);
  apply(t);
}

const COMPACT_KEY = 'slock-compact';
const [compactMode, setCompactModeSignal] = createSignal(localStorage.getItem(COMPACT_KEY) === '1');

function applyCompact(on: boolean) {
  document.documentElement.classList.toggle('compact-mode', on);
}
applyCompact(compactMode());

export function setCompactMode(on: boolean) {
  setCompactModeSignal(on);
  localStorage.setItem(COMPACT_KEY, on ? '1' : '0');
  applyCompact(on);
}

export { theme, compactMode };
