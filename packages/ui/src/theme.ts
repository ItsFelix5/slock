import { createSignal } from "solid-js";
// a continuous dial from 0 (compact) to 2 (large), 1 is the old "default" -
// not restricted to those three values, any point in between is valid.
export type MessageSize = number;

export interface MessageSizeMetrics {
  /** vertical padding above/below a lead (non-grouped) message row, in px */
  rowPaddingY: number;
  /** avatar width/height, in px */
  avatarSize: number;
  /** avatar's top margin, keeps it flush with the first line of text, in px */
  avatarMarginTop: number;
  /** avatar's initial-letter font size, in px */
  avatarFontSize: number;
  /** gap between the sender name and the timestamp, in px */
  metaGap: number;
}

// keyframes defining what each message size actually looks like - the single
// source of truth consumed both as CSS custom properties (below) and by the
// row-height estimator that drives the message list virtualizer. Values in
// between are linearly interpolated, so the slider isn't stepped.
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

const MESSAGE_SIZE_KEY = "slock-message-size";
const LEGACY_COMPACT_KEY = "slock-compact";

function loadMessageSize(): MessageSize {
  const raw = localStorage.getItem(MESSAGE_SIZE_KEY);
  const saved = raw === null ? Number.NaN : Number(raw);
  if (!Number.isNaN(saved)) return Math.min(2, Math.max(0, saved));
  return localStorage.getItem(LEGACY_COMPACT_KEY) === "1" ? 0 : 1;
}

const [messageSize, setMessageSizeSignal] = createSignal<MessageSize>(loadMessageSize());

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
  setMessageSizeSignal(size);
  localStorage.setItem(MESSAGE_SIZE_KEY, String(size));
  localStorage.removeItem(LEGACY_COMPACT_KEY);
  applyMessageSize(size);
}

const LOG_DELETED_KEY = "slock-log-deleted-messages";
const [logDeletedMessages, setLogDeletedMessagesSignal] = createSignal(
  localStorage.getItem(LOG_DELETED_KEY) === "1",
);

export function setLogDeletedMessages(on: boolean) {
  setLogDeletedMessagesSignal(on);
  localStorage.setItem(LOG_DELETED_KEY, on ? "1" : "0");
}

export { logDeletedMessages, messageSize };
