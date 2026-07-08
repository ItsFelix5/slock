// Slack's search.messages endpoint natively parses modifier tokens (from:, in:,
// has:, before:, after:, is:) inside the query string, so the advanced-search UI
// just assembles those tokens around the free-text terms. This module keeps that
// assembly pure and testable, separate from the React-ish component.

export interface SearchFilters {
  fromUserId?: string;
  inChannelId?: string;
  hasLink?: boolean;
  hasStar?: boolean;
  hasPin?: boolean;
  hasReaction?: boolean;
  after?: string; // yyyy-mm-dd
  before?: string; // yyyy-mm-dd
  isThread?: boolean;
  isSaved?: boolean;
}

export type SortMode = "relevant" | "newest" | "oldest";

export const EMPTY_FILTERS: SearchFilters = {};

export function hasActiveFilters(f: SearchFilters): boolean {
  return !!(
    f.fromUserId ||
    f.inChannelId ||
    f.hasLink ||
    f.hasStar ||
    f.hasPin ||
    f.hasReaction ||
    f.after ||
    f.before ||
    f.isThread ||
    f.isSaved
  );
}

export function buildSearchQuery(text: string, f: SearchFilters): string {
  const parts: string[] = [];
  const trimmed = text.trim();
  if (trimmed) parts.push(trimmed);
  if (f.fromUserId) parts.push(`from:<@${f.fromUserId}>`);
  if (f.inChannelId) parts.push(`in:<#${f.inChannelId}>`);
  if (f.hasLink) parts.push("has:link");
  if (f.hasStar) parts.push("has:star");
  if (f.hasPin) parts.push("has:pin");
  if (f.hasReaction) parts.push("has:reaction");
  if (f.after) parts.push(`after:${f.after}`);
  if (f.before) parts.push(`before:${f.before}`);
  if (f.isThread) parts.push("is:thread");
  if (f.isSaved) parts.push("is:saved");
  return parts.join(" ");
}

export function sortParams(mode: SortMode): {
  sort: "score" | "timestamp";
  sortDir: "asc" | "desc";
} {
  switch (mode) {
    case "newest":
      return { sort: "timestamp", sortDir: "desc" };
    case "oldest":
      return { sort: "timestamp", sortDir: "asc" };
    default:
      return { sort: "score", sortDir: "desc" };
  }
}
