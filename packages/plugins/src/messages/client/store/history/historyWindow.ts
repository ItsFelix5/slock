import type { Message } from "@slock/types";
import { mergeMessages } from "../../api/messageMerge";

const MAX_LOADED_MESSAGES = 120;

export type WindowMerge = { cut: boolean; list: Message[] };

export function mergeOlderWindow(existing: Message[], older: Message[]): WindowMerge {
  const merged = mergeMessages(existing, older);
  return { cut: merged.length > MAX_LOADED_MESSAGES, list: merged.slice(0, MAX_LOADED_MESSAGES) };
}

export function mergeNewerWindow(existing: Message[], newer: Message[]): WindowMerge {
  const merged = mergeMessages(existing, newer);
  return { cut: merged.length > MAX_LOADED_MESSAGES, list: merged.slice(-MAX_LOADED_MESSAGES) };
}
