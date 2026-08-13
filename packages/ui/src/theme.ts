import { createSignal } from "solid-js";

export type MessageSize = number;

export interface MessageSizeMetrics {
  rowPaddingY: number;
  avatarSize: number;
  avatarMarginTop: number;
  avatarFontSize: number;
  metaGap: number;
}

export interface ThemeAppearance {
  messageSize: MessageSize;
}

const MESSAGE_SIZE_KEYFRAMES: [number, MessageSizeMetrics][] = [
  [0, { avatarFontSize: 11, avatarMarginTop: 1, avatarSize: 22, metaGap: 4, rowPaddingY: 0 }],
  [1, { avatarFontSize: 14, avatarMarginTop: 2, avatarSize: 36, metaGap: 6, rowPaddingY: 2 }],
  [2, { avatarFontSize: 14, avatarMarginTop: 2, avatarSize: 40, metaGap: 6, rowPaddingY: 10 }],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function messageSizeMetrics(size: MessageSize): MessageSizeMetrics {
  const clamped = Math.min(2, Math.max(0, size));
  let segmentEnd = MESSAGE_SIZE_KEYFRAMES.length - 1;
  for (let i = 1; i < MESSAGE_SIZE_KEYFRAMES.length; i += 1) {
    if (clamped <= MESSAGE_SIZE_KEYFRAMES[i][0]) {
      segmentEnd = i;
      break;
    }
  }
  const [fromAt, from] = MESSAGE_SIZE_KEYFRAMES[segmentEnd - 1];
  const [toAt, to] = MESSAGE_SIZE_KEYFRAMES[segmentEnd];
  const t = (clamped - fromAt) / (toAt - fromAt);
  return {
    avatarFontSize: lerp(from.avatarFontSize, to.avatarFontSize, t),
    avatarMarginTop: lerp(from.avatarMarginTop, to.avatarMarginTop, t),
    avatarSize: lerp(from.avatarSize, to.avatarSize, t),
    metaGap: lerp(from.metaGap, to.metaGap, t),
    rowPaddingY: lerp(from.rowPaddingY, to.rowPaddingY, t),
  };
}

const THEME_APPEARANCE_KEY = "slock-theme-appearance";
const LEGACY_MESSAGE_SIZE_KEY = "slock-message-size";

function loadThemeAppearance(): ThemeAppearance {
  try {
    const stored = localStorage.getItem(THEME_APPEARANCE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ThemeAppearance>;
      if (typeof parsed.messageSize === "number")
        return { messageSize: Math.min(2, Math.max(0, parsed.messageSize)) };
    }
  } catch {
    localStorage.removeItem(THEME_APPEARANCE_KEY);
  }

  const legacyRaw = localStorage.getItem(LEGACY_MESSAGE_SIZE_KEY);
  const legacy = legacyRaw === null ? Number.NaN : Number(legacyRaw);
  const messageSize = Number.isNaN(legacy) ? 1 : Math.min(2, Math.max(0, legacy));
  const appearance = { messageSize };
  localStorage.setItem(THEME_APPEARANCE_KEY, JSON.stringify(appearance));
  localStorage.removeItem(LEGACY_MESSAGE_SIZE_KEY);
  return appearance;
}

const [themeAppearance, setThemeAppearanceSignal] = createSignal(loadThemeAppearance());
const messageSize = () => themeAppearance().messageSize;

function applyMessageSize(size: MessageSize) {
  const root = document.documentElement;
  const metrics = messageSizeMetrics(size);
  root.style.setProperty("--message-row-padding-y", `${metrics.rowPaddingY}px`);
  root.style.setProperty("--message-avatar-size", `${metrics.avatarSize}px`);
  root.style.setProperty("--message-avatar-margin-top", `${metrics.avatarMarginTop}px`);
  root.style.setProperty("--message-avatar-font-size", `${metrics.avatarFontSize}px`);
  root.style.setProperty("--message-meta-gap", `${metrics.metaGap}px`);
}

applyMessageSize(messageSize());

export function setMessageSize(size: MessageSize) {
  const messageSize = Math.min(2, Math.max(0, size));
  const next = { ...themeAppearance(), messageSize };
  setThemeAppearanceSignal(next);
  localStorage.setItem(THEME_APPEARANCE_KEY, JSON.stringify(next));
  applyMessageSize(messageSize);
}

export { messageSize, themeAppearance };
