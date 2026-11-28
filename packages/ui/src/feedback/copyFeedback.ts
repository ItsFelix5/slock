import { createDebouncer } from "@slock/core";
import { service } from "@slock/core/solid";
import { createSignal, getOwner, onCleanup } from "solid-js";

const env = service("env");

export function createCopyFeedback(
  ttlMs = 1200,
  onError?: () => void,
  writeText: (text: string) => Promise<void> = (text) => navigator.clipboard.writeText(text),
) {
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  const reset = createDebouncer(env, () => setCopiedKey(null), ttlMs);
  let active = true;
  let latestRequest = 0;

  if (getOwner()) {
    onCleanup(() => {
      active = false;
      reset.cancel();
    });
  }

  async function copy(text: string, key: string): Promise<boolean> {
    const request = ++latestRequest;
    try {
      await writeText(text);
      if (!active || request !== latestRequest) return true;
      setCopiedKey(key);
      reset.schedule();
      return true;
    } catch {
      if (active && request === latestRequest) onError?.();
      return false;
    }
  }

  return [copiedKey, copy] as const;
}
