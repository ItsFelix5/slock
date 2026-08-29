export function isDmId(id: string, isKnownDm: (id: string) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}

export function conversationKind(id: string, isKnownDm: (id: string) => boolean): "channel" | "dm" {
  return isDmId(id, isKnownDm) ? "dm" : "channel";
}
