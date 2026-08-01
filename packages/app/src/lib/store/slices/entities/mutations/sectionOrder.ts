import type { ChannelSection } from "@slock/slack-api";

export function applySectionOrder(
  sections: ChannelSection[],
  sectionIds: string[],
): ChannelSection[] {
  if (sectionIds.length === 0) return sections;
  const byId = new Map(sections.map((section) => [section.id, section]));
  const ordered = sectionIds
    .map((id) => byId.get(id))
    .filter((section): section is ChannelSection => !!section);
  const placed = new Set(ordered.map((section) => section.id));
  return [...ordered, ...sections.filter((section) => !placed.has(section.id))];
}

export function sectionMoveTarget(
  sectionIds: string[],
  sectionId: string,
  direction: -1 | 1,
): string | null | undefined {
  const index = sectionIds.indexOf(sectionId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= sectionIds.length) return;
  return direction === -1 ? sectionIds[destination] : (sectionIds[destination + 1] ?? null);
}

export function reorderSections(
  sections: ChannelSection[],
  sectionId: string,
  nextSectionId: string | null,
): ChannelSection[] | null {
  const moved = sections.find((section) => section.id === sectionId);
  if (!moved || nextSectionId === sectionId) return null;
  const without = sections.filter((section) => section.id !== sectionId);
  const target = nextSectionId
    ? without.findIndex((section) => section.id === nextSectionId)
    : without.length;
  if (target < 0) return null;
  const next = [...without.slice(0, target), moved, ...without.slice(target)];
  return next.every((section, index) => section.id === sections[index]?.id) ? null : next;
}
