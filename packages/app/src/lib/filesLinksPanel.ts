import { createRoot, createSignal } from "solid-js";
import { type SlackFile, type SlackLink, searchChannelFilesAndLinks } from "./api";
import { channelDisplayName, dmDisplayName } from "./displayName";
import { store } from "./store";

export type FilesLinksEntry =
  | { kind: "file"; sortTs: number; file: SlackFile }
  | { kind: "link"; sortTs: number; link: SlackLink };

function mergeEntries(files: SlackFile[], links: SlackLink[]): FilesLinksEntry[] {
  return [
    ...files.map((file): FilesLinksEntry => ({ file, kind: "file", sortTs: file.created ?? 0 })),
    ...links.map((link): FilesLinksEntry => ({ kind: "link", link, sortTs: parseFloat(link.ts) })),
  ].sort((a, b) => b.sortTs - a.sortTs);
}

function appendEntries(
  entries: FilesLinksEntry[],
  files: SlackFile[],
  links: SlackLink[],
): FilesLinksEntry[] {
  const filesById = new Map<string, SlackFile>();
  const linksById = new Map<string, SlackLink>();
  for (const entry of entries) {
    if (entry.kind === "file") filesById.set(entry.file.id, entry.file);
    else linksById.set(`${entry.link.ts}:${entry.link.url}`, entry.link);
  }
  for (const file of files) filesById.set(file.id, file);
  for (const link of links) linksById.set(`${link.ts}:${link.url}`, link);
  return mergeEntries([...filesById.values()], [...linksById.values()]);
}

function setup() {
  const [filesLinksChannelId, setFilesLinksChannelId] = createSignal<string | null>(null);
  const [filesLinksQuery, setFilesLinksQueryValue] = createSignal("");
  const [filesLinksEntries, setFilesLinksEntries] = createSignal<FilesLinksEntry[]>([]);
  const [filesLinksLoading, setFilesLinksLoading] = createSignal(false);
  const [filesLinksLoadError, setFilesLinksLoadError] = createSignal(false);
  const [filesLinksHasMore, setFilesLinksHasMore] = createSignal(false);
  const [filesLinksPage, setFilesLinksPage] = createSignal(1);
  let loadEpoch = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(channelId: string, query: string, page = 1) {
    const epoch = ++loadEpoch;
    setFilesLinksLoading(true);
    setFilesLinksLoadError(false);
    try {
      const dm = store.dms.dmById(channelId);
      const channelName = dm
        ? dmDisplayName(dm, store.users.userById) || channelId
        : channelDisplayName(store.channels.channelById(channelId), channelId);
      const { files, hasMore, links } = await searchChannelFilesAndLinks(
        channelId,
        channelName,
        query,
        page,
      );
      if (epoch !== loadEpoch) return;
      setFilesLinksEntries((entries) =>
        page === 1 ? mergeEntries(files, links) : appendEntries(entries, files, links),
      );
      setFilesLinksHasMore(hasMore);
      setFilesLinksPage(page);
    } catch {
      if (epoch !== loadEpoch) return;
      setFilesLinksLoadError(true);
    } finally {
      if (epoch === loadEpoch) setFilesLinksLoading(false);
    }
  }

  function openFilesLinksPanel(channelId: string) {
    clearTimeout(debounceTimer);
    setFilesLinksChannelId(channelId);
    setFilesLinksQueryValue("");
    setFilesLinksEntries([]);
    setFilesLinksHasMore(false);
    setFilesLinksPage(1);
    void load(channelId, "");
  }

  function closeFilesLinksPanel() {
    loadEpoch++;
    clearTimeout(debounceTimer);
    setFilesLinksLoading(false);
    setFilesLinksLoadError(false);
    setFilesLinksHasMore(false);
    setFilesLinksPage(1);
    setFilesLinksChannelId(null);
  }

  function setFilesLinksQuery(query: string) {
    setFilesLinksQueryValue(query);
    const channelId = filesLinksChannelId();
    if (!channelId) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => load(channelId, query), 300);
  }

  function retryFilesLinks() {
    const channelId = filesLinksChannelId();
    if (!channelId) return;
    clearTimeout(debounceTimer);
    void load(channelId, filesLinksQuery());
  }

  function loadMoreFilesLinks() {
    const channelId = filesLinksChannelId();
    if (!channelId || filesLinksLoading() || !filesLinksHasMore()) return;
    void load(channelId, filesLinksQuery(), filesLinksPage() + 1);
  }

  return {
    closeFilesLinksPanel,
    filesLinksChannelId,
    filesLinksEntries,
    filesLinksHasMore,
    filesLinksLoadError,
    filesLinksLoading,
    filesLinksQuery,
    loadMoreFilesLinks,
    openFilesLinksPanel,
    retryFilesLinks,
    setFilesLinksQuery,
  };
}

export const {
  closeFilesLinksPanel,
  filesLinksChannelId,
  filesLinksEntries,
  filesLinksHasMore,
  filesLinksLoadError,
  filesLinksLoading,
  filesLinksQuery,
  loadMoreFilesLinks,
  openFilesLinksPanel,
  retryFilesLinks,
  setFilesLinksQuery,
} = createRoot(setup);
