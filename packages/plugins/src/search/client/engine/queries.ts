import { defineMutation, definePagedQuery, defineQuery } from "@slock/plugins/query/client/api";
import type { SearchHistoryEntry, SearchResult, SlackFile, UsergroupMatch } from "@slock/types";
import {
  deleteSearch,
  type FileSearchArg,
  fetchFileTitles,
  fetchRecentFiles,
  fetchSearchHistory,
  fetchUsergroupMatches,
  type MessageSearchArg,
  saveSearch,
  searchFilePage,
  searchMessagePage,
} from "../requests";

const MAX_AGE_MS = 30_000;
const cached = { maxAgeMs: MAX_AGE_MS, revalidates: false };

export const messagePages = definePagedQuery<MessageSearchArg, SearchResult, number>({
  ...cached,
  itemKey: (message) => `${message.channelId}:${message.ts}`,
  load: (arg, page, { signal }) => searchMessagePage(arg, page ?? 1, signal),
  name: "searchMessages",
});

export const filePages = definePagedQuery<FileSearchArg, SlackFile, number>({
  ...cached,
  itemKey: (file) => file.id,
  load: (arg, page, { signal }) => searchFilePage(arg, page ?? 1, signal),
  name: "searchFiles",
});

export const fileTitles = defineQuery<string, SlackFile[]>({
  ...cached,
  load: (term, { signal }) => fetchFileTitles(term, signal),
  name: "searchFileTitles",
});

export const recentFiles = defineQuery<"recent", SlackFile[]>({
  ...cached,
  load: (_key, { signal }) => fetchRecentFiles(signal),
  name: "searchRecentFiles",
});

export const usergroupMatches = defineQuery<string, UsergroupMatch[]>({
  ...cached,
  load: (term, { signal }) => fetchUsergroupMatches(term, signal),
  name: "searchUsergroups",
});

export const searchHistory = defineQuery<"recent", SearchHistoryEntry[]>({
  ...cached,
  load: (_key, { signal }) => fetchSearchHistory(signal),
  name: "searchHistory",
});

export const saveToHistory = defineMutation<string>({
  onError: (error) => console.error("Failed to save search", error),
  onSuccess: () => searchHistory.invalidate("recent"),
  run: saveSearch,
});

export const removeFromHistory = defineMutation<string>({
  key: (hash) => hash,
  onError: (error) => console.error("Failed to remove search", error),
  optimistic: (hash, transaction) =>
    transaction.apply(searchHistory, "recent", (entries) =>
      entries.filter((entry) => entry.hash !== hash),
    ),
  run: deleteSearch,
});
