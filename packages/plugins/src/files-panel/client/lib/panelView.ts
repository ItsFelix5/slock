import { sameItems } from "@slock/core";
import { mentionText } from "@slock/plugins/users/client/api";
import type { FilesLinksEntry } from "../api";

export type TypeFilter = "all" | "images" | "files" | "links";
export type SortMode = "newest" | "oldest" | "name";
export const SORT_MODES: SortMode[] = ["newest", "oldest", "name"];

function monthLabel(seconds: number): string {
  if (!seconds) return "Undated";
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function linkDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return url;
  }
}

function entryTitle(entry: FilesLinksEntry): string {
  return entry.kind === "file"
    ? mentionText(entry.file.title || entry.file.name || "")
    : entry.link.title || entry.link.url;
}

export function matchesTypeFilter(entry: FilesLinksEntry, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "links") return entry.kind === "link";
  if (entry.kind !== "file") return false;
  return filter === "images" ? entry.file.isImage : !entry.file.isImage;
}

export type MonthGroup = { entries: FilesLinksEntry[]; label: string };

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
    return cached && sameItems(cached.entries, group.entries) ? cached : group;
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
