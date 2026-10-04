import type {
  Channel,
  DirectMessage,
  GlobalSearchResults as SearchResults,
  SlackFile,
  User,
} from "@slock/types";
import {
  createDebouncedRequest,
  createListboxActiveIndex,
  fuzzySearch,
  Icon,
  type ListDirection,
  listNavigationIndex,
  Modal,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, createUniqueId, Show, untrack } from "solid-js";
import { searchGlobal } from "../../lib/api";
import { dmDisplayName } from "../../lib/displayName";
import { clearPendingShare, pendingShareText } from "../../lib/incomingLinks";
import { store } from "../../lib/store";
import { seedDraft } from "../composer/lib/drafts";
import "./GlobalSearch.css";
import GlobalSearchInput from "./GlobalSearchInput";
import GlobalSearchResults, { type GlobalSearchRow, type JumpChannel } from "./GlobalSearchResults";

const MAX_ROWS = 30;
type Candidate = { row: GlobalSearchRow; name: string; id: string };
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
  const localChannelMatches = createMemo<Channel[]>(() => {
    const q = query().trim();
    if (!q) return [];
    return fuzzySearch(store.resources.bootstrap.data?.channels ?? [], {
      frequency: (c) => store.preferences.frecencyScore(c.id),
      query: q,
      text: (c) => c.name,
    });
  });
  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim();
    if (!q) return [];
    const me = store.users.currentUser()?.id;
    return fuzzySearch(
      store.users.knownUsers().filter((u) => u.id !== me),
      { frequency: (u) => store.preferences.frecencyScore(u.id), query: q, text: (u) => u.name },
    );
  });

  const mpdmResults = createMemo<DirectMessage[]>(() => {
    const q = query().trim();
    if (!q) return [];
    const mpdms = store.dms.directMessages().filter((dm) => dm.memberIds);
    return fuzzySearch(mpdms, {
      frequency: (dm) => store.preferences.frecencyScore(dm.id),
      query: q,
      text: (dm) => dmDisplayName(dm, store.users.userById),
    });
  });
  const searchDirectories = (value: string) => {
    setQuery(value);
    setActiveIndex(0);

    setCommittedRows([]);
    searchRequest.run(value);
  };
  const computedRows = createMemo<GlobalSearchRow[]>(() => {
    if (!hasQuery()) return [];
    const joinedIds = new Set(localChannelMatches().map((c) => c.id));
    const knownIds = new Set(localPeopleMatches().map((u) => u.id));
    const candidates: Candidate[] = [
      ...localChannelMatches().map(
        (c): Candidate => ({
          id: c.id,
          name: c.name,
          row: {
            data: { id: c.id, joined: true, name: c.name, private: c.private },
            kind: "channel",
          },
        }),
      ),
      ...remoteResults()
        .channels.filter((c) => !joinedIds.has(c.id))
        .map(
          (c): Candidate => ({
            id: c.id,
            name: c.name,
            row: {
              data: { id: c.id, joined: false, name: c.name, private: c.private },
              kind: "channel",
            },
          }),
        ),
      ...localPeopleMatches().map(
        (u): Candidate => ({ id: u.id, name: u.name, row: { data: u, kind: "person" } }),
      ),
      ...remoteResults()
        .users.filter((u) => !knownIds.has(u.id))
        .map((u): Candidate => ({ id: u.id, name: u.name, row: { data: u, kind: "person" } })),
      ...mpdmResults().map(
        (dm): Candidate => ({
          id: dm.id,
          name: dmDisplayName(dm, store.users.userById),
          row: { data: dm, kind: "dm" },
        }),
      ),
      ...remoteResults().files.map(
        (file): Candidate => ({
          id: file.id,
          name: file.title || file.name,
          row: { data: file, kind: "file" },
        }),
      ),
    ];
    const ranked = fuzzySearch(candidates, {
      frequency: (c) => store.preferences.frecencyScore(c.id),
      priority: (c) => (c.row.kind === "channel" && !c.row.data.joined ? 0 : 1),
      query: query(),
      text: (c) => c.name,
    });
    return ranked.slice(0, MAX_ROWS).map((c) => c.row);
  });
  createEffect(() => {
    if (!query().trim() || searching()) return;
    setCommittedRows(untrack(computedRows));
  });
  const recentRows = createMemo<GlobalSearchRow[]>(() => {
    const activeId = store.viewState.activeView()?.id;
    const channels = new Map(
      (store.resources.bootstrap.data?.channels ?? []).map((c) => [c.id, c]),
    );
    const dms = new Map(store.dms.directMessages().map((dm) => [dm.id, dm]));
    const recent: GlobalSearchRow[] = [];
    for (const id of store.preferences.recentIds()) {
      if (recent.length === MAX_ROWS) break;
      if (id === activeId) continue;
      const channel = channels.get(id);
      const dm = dms.get(id);
      if (channel) {
        recent.push({
          data: { id, joined: true, name: channel.name, private: channel.private },
          kind: "channel",
        });
      } else if (dm) recent.push({ data: dm, kind: "dm" });
    }
    return recent;
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
    store.viewState.setActiveView({ id: c.id, kind: "channel" });
    deliverPendingShare(c.id);
    props.onClose();
  };
  const goToPerson = async (userId: string) => {
    const dm = store.dms.directMessages().find((d) => d.userId === userId);
    if (dm) {
      store.viewState.setActiveView({ id: dm.id, kind: "dm" });
      deliverPendingShare(dm.id);
    } else {
      await store.dms.openDmWithUser(userId);
      const opened = store.viewState.activeView();
      if (opened?.kind === "dm") deliverPendingShare(opened.id);
    }
    props.onClose();
  };
  const goToDm = (dm: DirectMessage) => {
    store.viewState.setActiveView({ id: dm.id, kind: "dm" });
    deliverPendingShare(dm.id);
    props.onClose();
  };
  const goToMessageSearch = () => {
    store.viewState.openMessageSearch(query());
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
