export function planRecencyEviction(
  recent: string[],
  visible: string[],
  keep: number,
): { evict: string[]; recent: string[] } {
  const visibleSet = new Set(visible);
  const hidden = recent.filter((key) => !visibleSet.has(key));
  return {
    evict: hidden.slice(keep),
    recent: [...visibleSet, ...hidden.slice(0, keep)],
  };
}
