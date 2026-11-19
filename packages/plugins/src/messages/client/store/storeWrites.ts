import type { Message } from "@slock/types";
import { reconcile } from "solid-js";

export function replaceMessageList<K extends string>(
  draft: Record<K, Message[]>,
  key: K,
  next: Message[],
) {
  const current = draft[key];
  if (current === next) return;
  if (current) reconcile(next, "id")(current);
  else draft[key] = next;
}

export function updateMessageList<K extends string>(
  draft: Record<K, Message[]>,
  key: K,
  compute: (existing: Message[]) => Message[],
) {
  replaceMessageList(draft, key, compute(draft[key] ?? []));
}
