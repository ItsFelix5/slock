import type { SearchFilters, SortMode } from "../../lib/searchQuery";

export const HAS_TOGGLES: { key: keyof SearchFilters; label: string }[] = [
  { key: "hasLink", label: "Has link" },
  { key: "hasStar", label: "Starred" },
  { key: "hasPin", label: "Pinned" },
  { key: "hasReaction", label: "Has reaction" },
  { key: "isThread", label: "In thread" },
  { key: "isSaved", label: "Saved" },
];
export const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "relevant", label: "Most relevant" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];
