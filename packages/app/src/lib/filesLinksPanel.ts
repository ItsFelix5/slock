import { type SlackFile, type SlackLink, searchChannelFilesAndLinks } from "@slock/slack-api";
import { createRoot, createSignal } from "solid-js";
import { channelDisplayName, store } from "./store";

export type FilesLinksEntry =
  | { kind: "file"; sortTs: number; file: SlackFile }
  | { kind: "link"; sortTs: number; link: SlackLink };

function mergeEntries(files: SlackFile[], links: SlackLink[]): FilesLinksEntry[] {
  return [
    ...files.map((file): FilesLinksEntry => ({ file, kind: "file", sortTs: file.created ?? 0 })),
    ...links.map((link): FilesLinksEntry => ({ kind: "link", link, sortTs: parseFloat(link.ts) })),
  ].sort((a, b) => b.sortTs - a.sortTs);
}

function setup() {
  const [filesLinksChannelId, setFilesLinksChannelId] = createSignal<string | null>(null);
  const [filesLinksQuery, setFilesLinksQueryValue] = createSignal("");
  const [filesLinksEntries, setFilesLinksEntries] = createSignal<FilesLinksEntry[]>([]);
  const [filesLinksLoading, setFilesLinksLoading] = createSignal(false);
  const [filesLinksLoadError, setFilesLinksLoadError] = createSignal(false);
  let loadEpoch = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(channelId: string, query: string) {
    const epoch = ++loadEpoch;
    setFilesLinksLoading(true);
    setFilesLinksLoadError(false);
    try {
      const channel = store.channels.channelById(channelId);
      const channelName = channelDisplayName(channel, channelId);
      const { files, links } = await searchChannelFilesAndLinks(channelId, channelName, query);
      if (epoch !== loadEpoch) return;
      setFilesLinksEntries(mergeEntries(files, links));
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
    void load(channelId, "");
  }

  function closeFilesLinksPanel() {
    loadEpoch++;
    clearTimeout(debounceTimer);
    setFilesLinksLoading(false);
    setFilesLinksLoadError(false);
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

  return {
    closeFilesLinksPanel,
    filesLinksChannelId,
    filesLinksEntries,
    filesLinksLoadError,
    filesLinksLoading,
    filesLinksQuery,
    openFilesLinksPanel,
    retryFilesLinks,
    setFilesLinksQuery,
  };
}

export const {
  closeFilesLinksPanel,
  filesLinksChannelId,
  filesLinksEntries,
  filesLinksLoadError,
  filesLinksLoading,
  filesLinksQuery,
  openFilesLinksPanel,
  retryFilesLinks,
  setFilesLinksQuery,
} = createRoot(setup);
