import type { Page } from "@slock/resource";
import { mapAttachment, mapFile, replyError } from "@slock/slack";
import { apiGet, apiPost } from "@slock/slack/client";
import type {
  RawAttachment,
  RawFile,
  SearchHistoryEntry,
  SearchPage,
  SearchResult,
  SlackFile,
  UsergroupMatch,
} from "@slock/types";
import { type SortMode, sortParams } from "./searchQuery";

export interface FileSearchArg {
  query: string;
  sort: SortMode;
}

type RawSearchResult = Omit<SearchResult, "attachments" | "files"> & {
  attachments?: RawAttachment[];
  files?: RawFile[];
};

export interface MessageSearchArg extends FileSearchArg {
  excludeBots: boolean;
  myChannels: boolean;
}

async function get<Reply extends object>(
  path: string,
  params: Record<string, string>,
  signal: AbortSignal,
) {
  const data = await apiGet<Reply>(`/api/search/${path}?${new URLSearchParams(params)}`, signal);
  if (!data.ok) throw replyError(data, `search ${path} failed`);
  return data;
}

async function post(path: string, body: Record<string, string>): Promise<void> {
  const data = await apiPost(`/api/search/${path}`, body);
  if (!data.ok) throw replyError(data, `search ${path} failed`);
}

function toPage<Raw, Item>(
  reply: Partial<SearchPage<Raw>>,
  map: (item: Raw) => Item,
): Page<Item, number> {
  const { items = [], page = 1, pages = 0, total } = reply;
  return { items: items.map(map), next: page < pages ? page + 1 : undefined, total };
}

export async function searchMessagePage(
  { excludeBots, myChannels, query, sort }: MessageSearchArg,
  page: number,
  signal: AbortSignal,
): Promise<Page<SearchResult, number>> {
  const params = {
    ...sortParams(sort),
    ...(excludeBots ? { excludeBots: "1" } : {}),
    ...(myChannels ? { myChannels: "1" } : {}),
    page: String(page),
    query,
  };
  const data = await get<Partial<SearchPage<RawSearchResult>>>("messages", params, signal);
  return toPage(data, ({ attachments, files, ...result }) => ({
    ...result,
    attachments: attachments?.map(mapAttachment),
    files: files?.map(mapFile),
  }));
}

export async function searchFilePage(
  { query, sort }: FileSearchArg,
  page: number,
  signal: AbortSignal,
): Promise<Page<SlackFile, number>> {
  const params = { ...sortParams(sort), page: String(page), query };
  const data = await get<Partial<SearchPage<RawFile>>>("files", params, signal);
  return toPage(data, mapFile);
}

async function fileList(path: string, params: Record<string, string>, signal: AbortSignal) {
  const data = await get<{ files?: RawFile[] }>(path, params, signal);
  return (data.files ?? []).map(mapFile);
}

export const fetchFileTitles = (query: string, signal: AbortSignal) =>
  fileList("files/titles", { query }, signal);

export const fetchRecentFiles = (signal: AbortSignal) => fileList("files/recent", {}, signal);

export async function fetchUsergroupMatches(
  query: string,
  signal: AbortSignal,
): Promise<UsergroupMatch[]> {
  const data = await get<{ usergroups?: UsergroupMatch[] }>("usergroups", { query }, signal);
  return data.usergroups ?? [];
}

export async function fetchSearchHistory(signal: AbortSignal): Promise<SearchHistoryEntry[]> {
  const data = await get<{ entries?: SearchHistoryEntry[] }>("history", {}, signal);
  return data.entries ?? [];
}

export const saveSearch = (query: string) => post("history", { query });

export const deleteSearch = (hash: string) => post("history/delete", { hash });
