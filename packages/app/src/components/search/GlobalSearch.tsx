import type { BrowsableChannel, Channel, DirectMessage, User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import {
  Avatar,
  AvatarStack,
  fuzzySearch,
  Icon,
  Overlay,
  Tooltip,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { dmDisplayName, store } from "../../lib/store";
import "./GlobalSearch.css";

interface JumpChannel {
  id: string;
  joined: boolean;
  name: string;
  private: boolean;
}
type Row =
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage };
type Candidate = { row: Row; name: string; id: string };
type SearchItem =
  | { kind: "message-search" }
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage };
export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal("");
  const [remotePeople, setRemotePeople] = createSignal<User[]>([]);
  const [remoteChannels, setRemoteChannels] = createSignal<BrowsableChannel[]>([]);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);
  let peopleDebounce: ReturnType<typeof setTimeout> | undefined;
  let peopleRequestId = 0;
  let channelDebounce: ReturnType<typeof setTimeout> | undefined;
  let channelRequestId = 0;
  useEscapeClose(props.onClose);
  onCleanup(() => {
    clearTimeout(peopleDebounce);
    clearTimeout(channelDebounce);
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
  const channelResults = createMemo<JumpChannel[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const joined = localChannelMatches().map(
      (c): JumpChannel => ({ id: c.id, joined: true, name: c.name, private: c.private }),
    );
    const joinedIds = new Set(joined.map((c) => c.id));
    const remote = remoteChannels()
      .filter((c) => !joinedIds.has(c.id))
      .map((c): JumpChannel => ({ id: c.id, joined: false, name: c.name, private: c.private }));
    return [...joined, ...remote].slice(0, 20);
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
  const peopleResults = createMemo<User[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const merged = new Map<string, User>();
    for (const u of localPeopleMatches()) merged.set(u.id, u);
    for (const u of remotePeople()) merged.set(u.id, u);
    return [...merged.values()].slice(0, 20);
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
  const runPeopleSearch = () => {
    clearTimeout(peopleDebounce);
    const q = query().trim();
    if (!q) {
      setRemotePeople([]);
      return;
    }
    const id = ++peopleRequestId;
    peopleDebounce = setTimeout(async () => {
      const found = await store.users.searchUsers(q, store.users.currentUser()?.id);
      if (id === peopleRequestId) setRemotePeople(found);
    }, 250);
  };
  const runChannelSearch = () => {
    clearTimeout(channelDebounce);
    const q = query().trim();
    if (!q) {
      setRemoteChannels([]);
      return;
    }
    const id = ++channelRequestId;
    channelDebounce = setTimeout(async () => {
      const found = await fetchBrowsableChannels(q);
      if (id === channelRequestId) setRemoteChannels(found);
    }, 250);
  };
  const rows = createMemo<Row[]>(() => {
    if (!hasQuery()) return [];
    const candidates: Candidate[] = [
      ...channelResults().map(
        (c): Candidate => ({ id: c.id, name: c.name, row: { data: c, kind: "channel" } }),
      ),
      ...peopleResults().map(
        (u): Candidate => ({ id: u.id, name: u.name, row: { data: u, kind: "person" } }),
      ),
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
  const items = createMemo<SearchItem[]>(() => {
    if (!hasQuery()) return [];
    return [{ kind: "message-search" }, ...rows()];
  });
  createEffect(() => {
    const total = items().length;
    const current = activeIndex();
    if (total === 0) {
      if (current !== null) setActiveIndex(null);
      return;
    }
    if (current === null || current > total - 1) setActiveIndex(0);
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
  const moveActive = (delta: number) => {
    const total = items().length;
    if (!total) return;
    const current = activeIndex();
    const next = current === null ? 0 : Math.max(0, Math.min(total - 1, current + delta));
    setActiveIndex(next);
  };
  return (
    <Overlay onClose={props.onClose}>
      <div class="global-search-card modal-card">
        <div class="global-search-input-row flex-align-center">
          <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
          <input
            autofocus
            class="global-search-input input-reset"
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setActiveIndex(e.currentTarget.value.trim() ? 0 : null);
              runPeopleSearch();
              runChannelSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                moveActive(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moveActive(-1);
              } else if (e.key === "Enter" && hasQuery()) {
                e.preventDefault();
                const index = activeIndex();
                if (index === null) goToMessageSearch();
                else activateItem(index);
              }
            }}
            placeholder="Search channels, people, conversations…"
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
        <div class="global-search-results">
          <Show
            fallback={
              <div class="global-search-hint empty-state">
                Jump to a channel or person. (Ctrl+K)
              </div>
            }
            when={hasQuery()}
          >
            <button
              class="global-search-result global-search-message-action btn-reset flex-align-center"
              classList={{ active: activeIndex() === 0 }}
              onClick={goToMessageSearch}
              onMouseEnter={() => setActiveIndex(0)}
              type="button"
            >
              <span class="global-search-jump-icon">
                <Icon name="search" size={13} />
              </span>
              Search all messages for "{query()}"
            </button>
            <For each={rows()}>
              {(row, index) => {
                const itemIndex = () => index() + 1;
                if (row.kind === "channel") {
                  const c = row.data;
                  return (
                    <button
                      class="global-search-result global-search-jump btn-reset flex-align-center"
                      classList={{ active: activeIndex() === itemIndex() }}
                      onClick={() => goToChannel(c)}
                      onMouseEnter={() => setActiveIndex(itemIndex())}
                      type="button"
                    >
                      <span class="global-search-jump-icon">
                        {c.private ? <Icon name="lock" size={13} /> : "#"}
                      </span>
                      {c.name}
                    </button>
                  );
                }
                if (row.kind === "dm") {
                  const dm = row.data;
                  const members = (dm.memberIds ?? [])
                    .map((id) => store.users.userById(id))
                    .filter((m) => m !== undefined);
                  return (
                    <button
                      class="global-search-result global-search-jump btn-reset flex-align-center"
                      classList={{ active: activeIndex() === itemIndex() }}
                      onClick={() => goToDm(dm)}
                      onMouseEnter={() => setActiveIndex(itemIndex())}
                      type="button"
                    >
                      <AvatarStack size="small" users={members} />
                      {dmDisplayName(dm, store.users.userById)}
                    </button>
                  );
                }
                const u = row.data;
                return (
                  <button
                    class="global-search-result global-search-jump btn-reset flex-align-center"
                    classList={{ active: activeIndex() === itemIndex() }}
                    onClick={() => goToPerson(u.id)}
                    onMouseEnter={() => setActiveIndex(itemIndex())}
                    type="button"
                  >
                    <Avatar size="small" user={u} />
                    {u.name}
                  </button>
                );
              }}
            </For>
            <Show when={rows().length === 0}>
              <div class="global-search-empty empty-state">Noting found :c</div>
            </Show>
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
