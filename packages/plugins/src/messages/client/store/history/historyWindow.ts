import type { Message } from "@slock/types";
import { mergeMessages } from "../../api/messageMerge";

const MAX_LOADED_MESSAGES = 240;

type WindowMerge = { cut: boolean; list: Message[] };

export function mergeOlderWindow(existing: Message[], older: Message[]): WindowMerge {
  const merged = mergeMessages(existing, older);
  return { cut: merged.length > MAX_LOADED_MESSAGES, list: merged.slice(0, MAX_LOADED_MESSAGES) };
}

export function mergeNewerWindow(existing: Message[], newer: Message[]): WindowMerge {
  const merged = mergeMessages(existing, newer);
  return { cut: merged.length > MAX_LOADED_MESSAGES, list: merged.slice(-MAX_LOADED_MESSAGES) };
}

const HINT_WANTED_MESSAGES = 30;
const HINT_MIN_SECONDS = 60;
const HINT_MAX_SECONDS = 7 * 86_400;

export function newerSpanHint(messages: readonly Message[] | undefined): number | undefined {
  const first = messages?.at(0);
  const last = messages?.at(-1);
  if (!(first && last && messages && messages.length > 1)) return;
  const secondsPerMessage = (Number(last.ts) - Number(first.ts)) / (messages.length - 1);
  return Math.min(
    HINT_MAX_SECONDS,
    Math.max(HINT_MIN_SECONDS, secondsPerMessage * HINT_WANTED_MESSAGES),
  );
}
