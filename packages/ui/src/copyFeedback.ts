import { createSignal } from "solid-js";

// Powers the "copy to clipboard" checkmark-swap pattern: call `copy(text, key)`
// from a button's onClick, then check `copied() === key` to briefly swap that
// button's icon/label instead of popping a toast.
export function createCopyFeedback(ttlMs = 1200) {
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    clearTimeout(timer);
    setCopiedKey(key);
    timer = setTimeout(() => setCopiedKey(null), ttlMs);
  }

  return [copiedKey, copy] as const;
}
