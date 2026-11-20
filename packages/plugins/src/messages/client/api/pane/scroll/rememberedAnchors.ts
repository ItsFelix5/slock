import type { Ts } from "@slock/types";

export interface RememberedScrollAnchor {
  offset: number;
  ts: Ts;
}

const rememberedAnchors = new Map<string, RememberedScrollAnchor>();

export function forgetScrollAnchors() {
  rememberedAnchors.clear();
}

export function rememberScrollAnchor(key: string, anchor: RememberedScrollAnchor | undefined) {
  if (anchor) rememberedAnchors.set(key, anchor);
  else rememberedAnchors.delete(key);
}

export function getRememberedScrollAnchor(key: string) {
  return rememberedAnchors.get(key);
}
