import { service } from "@slock/core/solid";
import type { ChannelId, DirectMessage, SlackFile, UserId } from "@slock/types";
import {
  createListboxActiveIndex,
  Icon,
  type ListDirection,
  listNavigationIndex,
  Modal,
} from "@slock/ui";
import { createMemo, createSignal, createUniqueId, Show } from "solid-js";
import {
  clearPendingShare,
  pendingShareText,
} from "../../../message-links/client/api/incomingLinks";
import "./GlobalSearch.css";
import GlobalSearchInput from "./GlobalSearchInput";
import GlobalSearchResults, { type GlobalSearchRow, type JumpChannel } from "./GlobalSearchResults";
import { createGlobalSearchRows } from "./globalSearchRows";
import { createCommittedRows, MESSAGE_SEARCH_INDEX } from "./lib/committedRows";
import { createDirectorySearch } from "./lib/directorySearch";

const searchStore = service("search");

const viewStore = service("conversations");
const dmsStore = service("dms");
const drafts = service("drafts");

type SearchItem = { kind: "message-search" } | GlobalSearchRow;
export default function GlobalSearch(props: {
  onClose: () => void;
  onFile: (file: SlackFile) => void;
}) {
  const [query, setQuery] = createSignal("");
  const listboxId = createUniqueId();
  const directory = createDirectorySearch();
  const hasQuery = () => !!query().trim();
  const { computedRows, recentRows } = createGlobalSearchRows({
    hasQuery,
    query,
    remoteResults: directory.results,
  });
  const committed = createCommittedRows({
    hasQuery,
    onCommit: (selectedIndex) => setActiveIndex(selectedIndex),
    onSubmit: (index) => activateItem(index),
    ranked: computedRows,
    searching: directory.searching,
  });
  const searchDirectories = (value: string) => {
    setQuery(value);
    setActiveIndex(MESSAGE_SEARCH_INDEX);
    committed.restart();
    directory.run(value);
  };
  const rows = () => (hasQuery() ? committed.rows() : recentRows());
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
    if (directory.searching()) return "Searching people, channels, and files…";
    if (directory.error()) return "Search couldn't be completed.";
    return "No matching people, channels, or files.";
  });
  const deliverPendingShare = (channelId: ChannelId) => {
    const text = pendingShareText();
    if (!text) return;
    void drafts.seedDraft(channelId, undefined, text);
    clearPendingShare();
  };
  const goToChannel = (c: JumpChannel) => {
    viewStore.setActiveView({ id: c.id, kind: "channel" });
    deliverPendingShare(c.id);
    props.onClose();
  };
  const goToPerson = async (userId: UserId) => {
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
  const submitActiveRow = () => committed.submit(activeIndex());
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
