import type { ExistingContainer, FlowEntry } from "./flow.ts";
import { listStyleForKind } from "./lineStyles.ts";

export interface PlannedGroup {
  id: string;
  isNew: boolean;
  members: FlowEntry[];
  sourceId: string | null;
  style: number;
}

export interface GroupPlan {
  claimed: Set<string>;
  groupOf: Map<string, PlannedGroup>;
  groups: PlannedGroup[];
}

function candidateContainer(
  entry: FlowEntry,
  style: number,
  containers: Map<string, ExistingContainer>,
): string | null {
  const containerId = entry.existing?.containerId;
  if (!containerId) return null;
  return containers.get(containerId)?.style === style ? containerId : null;
}

export function groupLists(
  entries: FlowEntry[],
  containers: Map<string, ExistingContainer>,
  makeId: () => string,
): GroupPlan {
  const groups: PlannedGroup[] = [];
  const groupOf = new Map<string, PlannedGroup>();
  const claimed = new Set<string>();
  let current: PlannedGroup | null = null;

  function join(group: PlannedGroup, entry: FlowEntry) {
    group.members.push(entry);
    groupOf.set(entry.id, group);
  }

  for (const entry of entries) {
    const style = entry.line ? listStyleForKind(entry.line.kind) : null;
    if (style === null) {
      current = null;
      continue;
    }
    const candidate = candidateContainer(entry, style, containers);
    const sameStyle = current?.style === style;
    if (current && sameStyle && (candidate === null || candidate === current.sourceId)) {
      join(current, entry);
      continue;
    }
    if (current && sameStyle && current.sourceId === null && candidate && !claimed.has(candidate)) {
      claimed.delete(current.id);
      current.id = candidate;
      current.isNew = false;
      current.sourceId = candidate;
      claimed.add(candidate);
      join(current, entry);
      continue;
    }
    const boundaryTouched = entry.touched || (current?.members.at(-1)?.touched ?? false);
    if (current && sameStyle && candidate !== null && boundaryTouched) {
      join(current, entry);
      continue;
    }
    const reuse = candidate !== null && !claimed.has(candidate);
    const group: PlannedGroup = {
      id: reuse ? candidate : makeId(),
      isNew: !reuse,
      members: [],
      sourceId: candidate,
      style,
    };
    claimed.add(group.id);
    groups.push(group);
    join(group, entry);
    current = group;
  }
  return { claimed, groupOf, groups };
}
