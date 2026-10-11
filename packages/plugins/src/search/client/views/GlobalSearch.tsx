import { service } from "@slock/core/solid";
import type { DirectMessage, GlobalSearchResults as SearchResults, SlackFile } from "@slock/types";
import {
  createDebouncedRequest,
  createListboxActiveIndex,
  Icon,
  type ListDirection,
  listNavigationIndex,
  Modal,
} from "@slock/ui";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  Show,
  untrack,
} from "solid-js";
import { seedDraft } from "../../../drafts/client/api";
import {
  clearPendingShare,
  pendingShareText,
} from "../../../message-links/client/api/incomingLinks";
import { searchGlobal } from "../../../slack/client/api";
import "./GlobalSearch.css";
import GlobalSearchInput from "./GlobalSearchInput";
import GlobalSearchResults, { type GlobalSearchRow, type JumpChannel } from "./GlobalSearchResults";
import { createGlobalSearchRows } from "./globalSearchRows";

const searchStore = service("search");

const viewStore = service("conversations");
const dmsStore = service("dms");

type SearchItem = { kind: "message-search" } | GlobalSearchRow;
export default function GlobalSearch(props: {
  onClose: () => void;
  onFile: (file: SlackFile) => void;
}) {
  const [query, setQuery] = createSignal("");
  const [remoteResults, setRemoteResults] = createSignal<SearchResults>({
    channels: [],
    files: [],
    users: [],
  });

  const [committedRows, setCommittedRows] = createSignal<GlobalSearchRow[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [submitWhenReady, setSubmitWhenReady] = createSignal(false);
  const listboxId = createUniqueId();
  const searchRequest = createDebouncedRequest(searchGlobal, {
    delay: 100,
    onError: () => setSearchError(true),
    onPendingChange: setSearching,
    onReset: () => {
      setSearchError(false);
      setRemoteResults({ channels: [], files: [], users: [] });
    },
    onResult: setRemoteResults,
  });
  const hasQuery = () => !!query().trim();
  const { computedRows, recentRows } = createGlobalSearchRows({ hasQuery, query, remoteResults });
  const searchDirectories = (value: string) => {
    batch(() => {
      setQuery(value);
      setActiveIndex(0);
      setCommittedRows([]);
      setSubmitWhenReady(false);
      searchRequest.run(value);
    });
  };
  createEffect(() => {
    if (!query().trim() || searching()) return;
    const ranked = untrack(computedRows);
    setCommittedRows(ranked);
    const best = ranked.length > 0 ? 1 : 0;
    setActiveIndex(best);
    if (untrack(submitWhenReady)) {
      setSubmitWhenReady(false);
      activateItem(best);
    }
  });
  const rows = () => (hasQuery() ? committedRows() : recentRows());
  const items = createMemo<SearchItem[]>(() =>
    hasQuery() ? [{ kind: "message-search" }, ...rows()] : rows(),
  );
  const { activeIndex, setActiveIndex } = createListboxActiveIndex(
    () => items().length,
    listboxId,
    () => document.getElementById(listboxId) ?? undefined,
  );
  const searchStatus = createMemo(() => {
    if (!hasQuery()) return "";
    if (rows().length > 0) return "";
    if (searching()) return "Searching people, channels, and files…";
    if (searchError()) return "Search couldn't be completed.";
    return "No matching people, channels, or files.";
  });
  const deliverPendingShare = (channelId: string) => {
    const text = pendingShareText();
    if (!text) return;
    void seedDraft(channelId, undefined, text);
    clearPendingShare();
  };
  const goToChannel = (c: JumpChannel) => {
    viewStore.setActiveView({ id: c.id, kind: "channel" });
    deliverPendingShare(c.id);
    props.onClose();
  };
  const goToPerson = async (userId: string) => {
    const dm = dmsStore.directMessages().find((d) => d.userId === userId);
    if (dm) {
      viewStore.setActiveView({ id: dm.id, kind: "dm" });
      deliverPendingShare(dm.id);
    } else {
      await dmsStore.openDmWithUser(userId);
      const opened = viewStore.activeView();
      if (opened?.kind === "dm") deliverPendingShare(opened.id);
    }
    props.onClose();
  };
  const goToDm = (dm: DirectMessage) => {
    viewStore.setActiveView({ id: dm.id, kind: "dm" });
    deliverPendingShare(dm.id);
    props.onClose();
  };
  const goToMessageSearch = () => {
    searchStore.openSearch(query());
    props.onClose();
  };
  const openFile = (file: SlackFile) => {
    props.onFile(file);
    props.onClose();
  };
  const activateItem = (index: number) => {
    const item = items()[index];
    if (!item) return;
    if (item.kind === "message-search") {
      goToMessageSearch();
      return;
    }
    if (item.kind === "channel") {
      goToChannel(item.data);
      return;
    }
    if (item.kind === "dm") {
      goToDm(item.data);
      return;
    }
    if (item.kind === "file") {
      openFile(item.data);
      return;
    }
    goToPerson(item.data.id);
  };
  const moveActive = (direction: ListDirection) => {
    const next = listNavigationIndex(direction, activeIndex(), items().length);
    if (next !== undefined) setActiveIndex(next);
  };
  const submitActiveRow = () => {
    if (hasQuery() && searching() && rows().length === 0) {
      setSubmitWhenReady(true);
      return;
    }
    const index = activeIndex();
    if (index !== null) activateItem(index);
  };
  return (
    <Modal align="top" ariaLabel="Search Slack" class="global-search-card" onClose={props.onClose}>
      <Show when={pendingShareText()}>
        {(text) => (
          <div class="global-search-share-banner flex-align-center">
            <Icon class="flex-shrink-0" name="share" size={13} />
            <span class="truncate">Pick where to send: {text()}</span>
          </div>
        )}
      </Show>
      <GlobalSearchInput
        onNavigateRows={moveActive}
        onQuery={searchDirectories}
        onSubmitRow={submitActiveRow}
        query={query}
      />
      <GlobalSearchResults
        activeIndex={activeIndex()}
        hasQuery={hasQuery()}
        listboxId={listboxId}
        onActiveIndex={setActiveIndex}
        onChannel={goToChannel}
        onDm={goToDm}
        onFile={openFile}
        onMessageSearch={goToMessageSearch}
        onPerson={goToPerson}
        query={query()}
        rows={rows()}
        status={searchStatus()}
      />
    </Modal>
  );
}
