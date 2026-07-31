export type SectionChannelRemoval = readonly [sectionId: string, channelIds: string[]];

export async function removeSectionChannelsBatched(
  removals: SectionChannelRemoval[],
  updateSection: (sectionId: string, channelIds: string[]) => Promise<boolean>,
  onError: (sectionId: string, error: unknown) => void,
): Promise<Set<string>> {
  const results = await Promise.allSettled(
    removals.map(([sectionId, channelIds]) => updateSection(sectionId, channelIds)),
  );
  const removed = new Set<string>();
  for (const [index, result] of results.entries()) {
    const [sectionId, channelIds] = removals[index];
    if (result.status === "fulfilled") {
      if (result.value) for (const channelId of channelIds) removed.add(channelId);
    } else {
      onError(sectionId, result.reason);
    }
  }
  return removed;
}
