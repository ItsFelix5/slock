import { service } from "@slock/core/solid";
import type { ChannelId, FileId, Ts } from "@slock/types";
import { createSignal } from "solid-js";
import { loadFileDetail } from "../../../files/client/api/fileDetailQuery";
import { fetchMessagesByIds, searchChannelFilesAndLinks } from "../../../slack/client/api";
import { appendEntries, type FilesLinksEntry, mergeEntries } from "./entries";

export type { FilesLinksEntry } from "./entries";

const messageLinks = service("message-links");
const titles = service("titles");

const QUERY_DEBOUNCE_MS = 300;

type OpenMessage = (channelId: ChannelId, ts: Ts, threadTs?: Ts) => void;

type PanelDeps = {
  openMessage: OpenMessage;
  search: typeof searchChannelFilesAndLinks;
  title: (channelId: ChannelId) => string;
};

interface PanelState {
  channelId: ChannelId | null;
  entries: FilesLinksEntry[];
  error: boolean;
  hasMore: boolean;
  loading: boolean;
  page: number;
  query: string;
}

const CLOSED: PanelState = {
  channelId: null,
  entries: [],
  error: false,
  hasMore: false,
  loading: false,
  page: 1,
  query: "",
};

const liveDeps: PanelDeps = {
  openMessage: (channelId, ts, threadTs) =>
    messageLinks.openChannelMessage(channelId, ts, threadTs),
  search: searchChannelFilesAndLinks,
  title: (channelId) => titles.title(channelId),
};

export function createFilesLinksPanel(deps: PanelDeps = liveDeps) {
  let state = CLOSED;
  const [view, setView] = createSignal(state);
  let loadEpoch = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function commit(patch: Partial<PanelState>) {
    state = { ...state, ...patch };
    setView(state);
  }

  async function load(channelId: ChannelId, query: string, page = 1) {
    const epoch = ++loadEpoch;
    commit({ error: false, loading: true });
    try {
      const { files, hasMore, links } = await deps.search(
        channelId,
        deps.title(channelId),
        query,
        page,
      );
      if (epoch !== loadEpoch) return;
      commit({
        entries:
          page === 1 ? mergeEntries(files, links) : appendEntries(state.entries, files, links),
        hasMore,
        page,
      });
    } catch {
      if (epoch === loadEpoch) commit({ error: true });
    } finally {
      if (epoch === loadEpoch) commit({ loading: false });
    }
  }

  function openFilesLinksPanel(channelId: ChannelId) {
    clearTimeout(debounceTimer);
    commit({ channelId, entries: [], hasMore: false, page: 1, query: "" });
    void load(channelId, "");
  }

  function closeFilesLinksPanel() {
    loadEpoch++;
    clearTimeout(debounceTimer);
    commit({ channelId: null, error: false, hasMore: false, loading: false, page: 1 });
  }

  function jumpToFilesLinksMessage(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
    closeFilesLinksPanel();
    deps.openMessage(channelId, ts, threadTs);
  }

  async function openFileMessage(channelId: ChannelId, fileId: FileId, open: OpenMessage) {
    const { shares } = await loadFileDetail(fileId);
    const share = shares.find((s) => s.channelId === channelId) ?? shares[0];
    if (share) open(share.channelId, share.ts, share.threadTs);
  }

  async function openLinkMessage(channelId: ChannelId, ts: Ts, open: OpenMessage) {
    const messages = await fetchMessagesByIds([{ channelId, ts }]);
    open(channelId, ts, messages.get(`${channelId}:${ts}`)?.threadTs);
  }

  function setFilesLinksQuery(query: string) {
    commit({ query });
    const { channelId } = state;
    if (!channelId) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void load(channelId, query), QUERY_DEBOUNCE_MS);
  }

  function retryFilesLinks() {
    const { channelId, query } = state;
    if (!channelId) return;
    clearTimeout(debounceTimer);
    void load(channelId, query);
  }

  function loadMoreFilesLinks() {
    const { channelId, error, hasMore, loading, page, query } = state;
    if (!channelId || loading || error || !hasMore) return;
    void load(channelId, query, page + 1);
  }

  return {
    closeFilesLinksPanel,
    filesLinksChannelId: () => view().channelId,
    filesLinksEntries: () => view().entries,
    filesLinksHasMore: () => view().hasMore,
    filesLinksLoadError: () => view().error,
    filesLinksLoading: () => view().loading,
    filesLinksQuery: () => view().query,
    jumpToFilesLinksMessage,
    loadMoreFilesLinks,
    openFileMessage,
    openFilesLinksPanel,
    openLinkMessage,
    retryFilesLinks,
    setFilesLinksQuery,
  };
}
