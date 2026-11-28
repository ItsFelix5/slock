import type { Ts } from "@slock/types";

interface RememberedScrollAnchor {
  offset: number;
  ts: Ts;
}

export function createScrollAnchors() {
  const anchors = new Map<string, RememberedScrollAnchor>();
  return {
    forget: (key: string) => void anchors.delete(key),
    get: (key: string) => anchors.get(key),
    remember: (key: string, anchor: RememberedScrollAnchor | undefined) => {
      if (anchor) anchors.set(key, anchor);
      else anchors.delete(key);
    },
  };
}
