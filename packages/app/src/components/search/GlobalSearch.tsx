import type { BrowsableChannel, Channel, DirectMessage, User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import {
  createDebouncedRequest,
  createListboxActiveIndex,
  fuzzySearch,
  Icon,
  listNavigationIndex,
  Overlay,
  Tooltip,
  useEscapeClose,
} from "@slock/ui";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
} from "solid-js";
import { dmDisplayName, store } from "../../lib/store";
import "./GlobalSearch.css";
import GlobalSearchResults, { type GlobalSearchRow, type JumpChannel } from "./GlobalSearchResults";

type Candidate = { row: GlobalSearchRow; name: string; id: string };
type SearchItem =
  | { kind: "message-search" }
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage };
export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal("");
  const [remotePeople, setRemotePeople] = createSignal<User[]>([]);
  const [remoteChannels, setRemoteChannels] = createSignal<BrowsableChannel[]>([]);
  // Frozen snapshot of results: written exactly once per query, only once
  // both local and remote data have fully settled, so the visible list never
  // shuffles or grows after it's already on screen.
  const [committedRows, setCommittedRows] = createSignal<GlobalSearchRow[]>([]);
  const [peopleSearching, setPeopleSearching] = createSignal(false);
  const [channelsSearching, setChannelsSearching] = createSignal(false);
  const [peopleError, setPeopleError] = createSignal(false);
  const [channelsError, setChannelsError] = createSignal(false);
  const listboxId = createUniqueId();
  useEscapeClose(props.onClose);
  const peopleRequest = createDebouncedRequest(
    (q) => store.users.searchUsers(q, store.users.currentUser()?.id),
    {
      delay: 100,
      onError: () => setPeopleError(true),
      onPendingChange: setPeopleSearching,
      onReset: () => {
        setPeopleError(false);
        setRemotePeople([]);
      },
      onResult: setRemotePeople,
    },
  );
  const channelRequest = createDebouncedRequest(fetchBrowsableChannels, {
    delay: 100,
    onError: () => setChannelsError(true),
    onPendingChange: setChannelsSearching,
    onReset: () => {
      setChannelsError(false);
      setRemoteChannels([]);
    },
    onResult: setRemoteChannels,
  });
  onCleanup(() => {
    peopleRequest.dispose();
    channelRequest.dispose();
  });
  const hasQuery = createMemo(() => !!query().trim());
  const localChannelMatches = createMemo<Channel[]>(() => {
    const q = query().trim();
    if (!q) return [];
    return fuzzySearch(store.resources.bootstrap()?.channels ?? [], {
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
  // Multi-person DMs have no single person to find them through the way a
  // regular DM's other participant does — this is their only way back into
  // search once closed from the sidebar.
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
    setActiveIndex(value.trim() ? 0 : null);
    // Clear the frozen result set right away so a new query never briefly
    // shows the previous query's (now mismatched) results.
    setCommittedRows([]);
    peopleRequest.run(value);
    channelRequest.run(value);
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
      ...remoteChannels()
        .filter((c) => !joinedIds.has(c.id))
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
      ...remotePeople()
        .filter((u) => !knownIds.has(u.id))
        .map((u): Candidate => ({ id: u.id, name: u.name, row: { data: u, kind: "person" } })),
      ...mpdmResults().map(
        (dm): Candidate => ({
          id: dm.id,
          name: dmDisplayName(dm, store.users.userById),
          row: { data: dm, kind: "dm" },
        }),
      ),
    ];
    const ranked = fuzzySearch(candidates, {
      frequency: (c) => store.preferences.frecencyScore(c.id),
      priority: (c) => (c.row.kind === "channel" && !c.row.data.joined ? 0 : 1),
      query: query(),
      text: (c) => c.name,
    });
    return ranked.slice(0, 8).map((c) => c.row);
  });
  createEffect(() => {
    if (!query().trim() || peopleSearching() || channelsSearching()) return;
    setCommittedRows(untrack(computedRows));
  });
  const rows = committedRows;
  const items = createMemo<SearchItem[]>(() => {
    if (!hasQuery()) return [];
    return [{ kind: "message-search" }, ...rows()];
  });
  const searching = () => peopleSearching() || channelsSearching();
  const searchError = () => peopleError() || channelsError();
  const { activeIndex, setActiveIndex, activeOptionId } = createListboxActiveIndex(
    () => items().length,
    listboxId,
    () => document.getElementById(listboxId) ?? undefined,
  );
  const searchStatus = createMemo(() => {
    if (!hasQuery()) return "";
    if (rows().length > 0) return "";
    if (searching()) return "Searching people and channels…";
    if (searchError()) return "Some directory suggestions couldn’t be loaded.";
    return "No matching people or channels.";
  });
  const goToChannel = (c: JumpChannel) => {
    store.viewState.setActiveView({ id: c.id, kind: "channel" });
    props.onClose();
  };
  const goToPerson = (userId: string) => {
    const dm = store.dms.directMessages().find((d) => d.userId === userId);
    if (dm) store.viewState.setActiveView({ id: dm.id, kind: "dm" });
    else store.dms.openDmWithUser(userId);
    props.onClose();
  };
  const goToDm = (dm: DirectMessage) => {
    store.viewState.setActiveView({ id: dm.id, kind: "dm" });
    props.onClose();
  };
  const goToMessageSearch = () => {
    store.viewState.openMessageSearch(query());
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
    goToPerson(item.data.id);
  };
  const moveActive = (key: string) => {
    const next = listNavigationIndex(key, activeIndex(), items().length);
    if (next !== undefined) setActiveIndex(next);
  };
  return (
    <Overlay align="top" ariaLabel="Search Slack" onClose={props.onClose}>
      <div class="global-search-card modal-card">
        <div class="global-search-input-row flex-align-center">
          <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
          <input
            aria-activedescendant={activeOptionId()}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={hasQuery()}
            aria-label="Search channels, people, and conversations"
            autofocus
            autocomplete="off"
            class="global-search-input input-reset"
            onInput={(e) => searchDirectories(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                moveActive(e.key);
              } else if ((e.key === "Home" || e.key === "End") && hasQuery()) {
                e.preventDefault();
                moveActive(e.key);
              } else if (e.key === "Enter" && hasQuery()) {
                e.preventDefault();
                const index = activeIndex();
                if (index === null) goToMessageSearch();
                else activateItem(index);
              }
            }}
            placeholder="Search channels, people, conversations…"
            role="combobox"
            spellcheck={false}
            type="text"
            value={query()}
          />
          <Tooltip content="Close">
            <button
              aria-label="Close"
              class="panel-close-btn"
              onClick={props.onClose}
              type="button"
            >
              <Icon name="close" size={12} />
            </button>
          </Tooltip>
        </div>
        <GlobalSearchResults
          activeIndex={activeIndex()}
          hasQuery={hasQuery()}
          listboxId={listboxId}
          onActiveIndex={setActiveIndex}
          onChannel={goToChannel}
          onDm={goToDm}
          onMessageSearch={goToMessageSearch}
          onPerson={goToPerson}
          query={query()}
          rows={rows()}
          searching={searching()}
          status={searchStatus()}
        />
      </div>
    </Overlay>
  );
}
