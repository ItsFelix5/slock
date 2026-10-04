import type { EntityIndex } from "../slackReplies.ts";

type Entity = { id?: string };

function findInIndex<E extends Entity>(index: EntityIndex<E> | undefined, id: string) {
  if (!index) return;
  if (Array.isArray(index)) return index.find((entity) => entity.id === id);
  return index[id] ?? Object.values(index).find((entity) => entity.id === id);
}

export function cachedEntityForId<E extends Entity>(
  sources: { index?: EntityIndex<E>; results?: EntityIndex<E>; single?: E },
  id: string,
): E | undefined {
  const found = findInIndex(sources.index, id) ?? findInIndex(sources.results, id);
  if (found) return found;
  return sources.single?.id === id ? sources.single : undefined;
}
