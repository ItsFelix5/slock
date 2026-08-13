export function isDmId(id: string, isKnownDm: (id: string) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}
