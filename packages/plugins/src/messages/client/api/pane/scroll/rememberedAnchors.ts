import type { ChannelId, Ts } from "@slock/types";

export interface RememberedScrollAnchor {
  offset: number;
  ts: Ts;
}

const rememberedAnchors = new Map<ChannelId, RememberedScrollAnchor>();

export function forgetScrollAnchors() {
  rememberedAnchors.clear();
}

export function rememberScrollAnchor(key: ChannelId, anchor: RememberedScrollAnchor | undefined) {
  if (anchor) rememberedAnchors.set(key, anchor);
  else rememberedAnchors.delete(key);
}

export function getRememberedScrollAnchor(key: ChannelId) {
  return rememberedAnchors.get(key);
}
