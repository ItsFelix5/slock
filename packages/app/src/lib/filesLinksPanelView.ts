import type { FilesLinksEntry } from "./filesLinksPanel";

const WWW_PREFIX_RE = /^www\./;

export type TypeFilter = "all" | "images" | "files" | "links";
export type SortMode = "newest" | "oldest" | "name";
export const SORT_MODES: SortMode[] = ["newest", "oldest", "name"];

export function formatDate(seconds: number | undefined): string {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function monthLabel(seconds: number): string {
  if (!seconds) return "Undated";
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_RE, "");
  } catch {
    return url;
  }
}

export function entryTitle(entry: FilesLinksEntry): string {
  return entry.kind === "file"
    ? entry.file.title || entry.file.name || ""
    : entry.link.title || entry.link.url;
}

export function matchesTypeFilter(entry: FilesLinksEntry, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "links") return entry.kind === "link";
  if (entry.kind !== "file") return false;
  return filter === "images" ? entry.file.isImage : !entry.file.isImage;
}

export type MonthGroup = { entries: FilesLinksEntry[]; label: string };

function sameEntries(a: FilesLinksEntry[], b: FilesLinksEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry === b[i]);
}

export function groupByMonth(
  entries: FilesLinksEntry[],
  cache: Map<string, MonthGroup>,
): MonthGroup[] {
  const raw: MonthGroup[] = [];
  for (const entry of entries) {
    const label = monthLabel(entry.sortTs);
    const current = raw.at(-1);
    if (current?.label === label) current.entries.push(entry);
    else raw.push({ entries: [entry], label });
  }
  const groups = raw.map((group) => {
    const cached = cache.get(group.label);
    return cached && sameEntries(cached.entries, group.entries) ? cached : group;
  });
  cache.clear();
  for (const group of groups) cache.set(group.label, group);
  return groups;
}

export function sortEntries(entries: FilesLinksEntry[], mode: SortMode): FilesLinksEntry[] {
  if (mode === "newest") return entries;
  const list = [...entries];
  if (mode === "oldest") list.sort((a, b) => a.sortTs - b.sortTs);
  else list.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b)));
  return list;
}
