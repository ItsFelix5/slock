import { createSignal, getOwner, onCleanup } from "solid-js";

export function createCopyFeedback(
  ttlMs = 1200,
  onError?: () => void,
  writeText: (text: string) => Promise<void> = (text) => navigator.clipboard.writeText(text),
) {
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let latestRequest = 0;

  if (getOwner()) {
    onCleanup(() => {
      active = false;
      clearTimeout(timer);
    });
  }

  async function copy(text: string, key: string): Promise<boolean> {
    const request = ++latestRequest;
    try {
      await writeText(text);
      if (!active || request !== latestRequest) return true;
      clearTimeout(timer);
      setCopiedKey(key);
      timer = setTimeout(() => setCopiedKey(null), ttlMs);
      return true;
    } catch {
      if (active && request === latestRequest) onError?.();
      return false;
    }
  }

  return [copiedKey, copy] as const;
}
