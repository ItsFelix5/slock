import { createDebouncer } from "@slock/core";
import { service } from "@slock/core/solid";
import { loadFileDetail } from "@slock/plugins/files/client/api/fileDetailQuery";
import { definePagedQuery } from "@slock/plugins/query/client/api";
import { fetchMessagesByIds } from "@slock/plugins/slack/client/api";
import { isWaiting } from "@slock/resource";
import type { ChannelId, FileId, Ts } from "@slock/types";
import { createMemo, createSignal } from "solid-js";
import { searchChannelFilesAndLinks } from "../requests";
import { entryKey, type FilesLinksEntry, newestFirst, toEntries } from "./entries";

export type { FilesLinksEntry } from "./entries";

const messageLinks = service("message-links");
const titles = service("titles");
const env = service("env");

const QUERY_DEBOUNCE_MS = 300;

type OpenMessage = (channelId: ChannelId, ts: Ts, threadTs?: Ts) => void;

type PanelDeps = {
  openMessage: OpenMessage;
  search: typeof searchChannelFilesAndLinks;
  title: (channelId: ChannelId) => string;
};

type Search = { channelId: ChannelId; opened: number; query: string; run: number };

type Shown = { entries: FilesLinksEntry[]; opened?: number };

const NOTHING: Shown = { entries: [] };

const liveDeps: PanelDeps = {
  openMessage: (channelId, ts, threadTs) =>
    messageLinks.openChannelMessage(channelId, ts, threadTs),
  search: searchChannelFilesAndLinks,
  title: (channelId) => titles.title(channelId),
};

export function createFilesLinksPanel(deps: PanelDeps = liveDeps) {
  const results = definePagedQuery<Search, FilesLinksEntry, number>({
    gcMs: 0,
    itemKey: entryKey,
    load: async ({ channelId, query }, cursor: number | undefined, { signal }) => {
      const page = cursor ?? 1;
      const title = deps.title(channelId);
      const { files, hasMore, links } = await deps.search(channelId, title, query, page, signal);
      return { items: toEntries(files, links), next: hasMore ? page + 1 : undefined };
    },
    name: "filesLinks",
  });
  let current: Search | undefined;
  let runs = 0;
  const [search, setSearch] = createSignal<Search>();
  const [typed, setTyped] = createSignal("");
  const state = results.state(search);
  const data = createMemo(() => state().data);
  const shown = createMemo<Shown>((previous) => {
    const request = search();
    if (!request) return previous ?? NOTHING;
    const loaded = data();
    if (loaded) return { entries: loaded.items.toSorted(newestFirst), opened: request.opened };
    return previous?.opened === request.opened ? previous : NOTHING;
  });

  const loading = () => {
    const request = search();
    return !!request && (isWaiting(state()) || state().refreshing || results.loadingMore(request));
  };
  const failed = () => {
    const request = search();
    if (!request) return false;
    return (state().status === "error" && !state().refreshing) || results.moreFailed(request);
  };

  function show(next: Search | undefined) {
    current = next;
    setSearch(next);
  }

  const queryChange = createDebouncer(
    env,
    (query: string) => {
      if (current) show({ ...current, query, run: ++runs });
    },
    QUERY_DEBOUNCE_MS,
  );

  function openFilesLinksPanel(channelId: ChannelId) {
    queryChange.cancel();
    setTyped("");
    const run = ++runs;
    show({ channelId, opened: run, query: "", run });
  }

  function closeFilesLinksPanel() {
    queryChange.cancel();
    show(undefined);
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
    setTyped(query);
    if (current) queryChange.schedule(query);
  }

  function retryFilesLinks() {
    if (!current) return;
    if (queryChange.pending()) queryChange.flush();
    else if (results.moreFailed(current)) void results.more(current);
    else void results.refresh(current).catch(() => {});
  }

  function loadMoreFilesLinks() {
    if (!current || loading() || failed() || data()?.next === undefined) return;
    void results.more(current);
  }

  return {
    closeFilesLinksPanel,
    filesLinksChannelId: () => search()?.channelId ?? null,
    filesLinksEntries: () => shown().entries,
    filesLinksHasMore: () => !!search() && data()?.next !== undefined,
    filesLinksLoadError: failed,
    filesLinksLoading: loading,
    filesLinksQuery: typed,
    jumpToFilesLinksMessage,
    loadMoreFilesLinks,
    openFileMessage,
    openFilesLinksPanel,
    openLinkMessage,
    retryFilesLinks,
    setFilesLinksQuery,
  };
}
