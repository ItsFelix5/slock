import type { BrowsableChannel, Channel, User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { Avatar, fuzzySearch, Icon, Overlay, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import {
  bootstrap,
  currentUser,
  directMessages,
  frecencyScore,
  knownUsers,
  openDmWithUser,
  openMessageSearch,
  searchUsers,
  setActiveView,
} from "../../lib/store";
import "./GlobalSearch.css";

interface JumpChannel {
  id: string;
  name: string;
  private: boolean;
  joined: boolean;
}

type Row = { kind: "channel"; data: JumpChannel } | { kind: "person"; data: User };
type Candidate = { row: Row; name: string; id: string };
type SearchItem =
  | { kind: "message-search" }
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User };

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

  // Ranked (not just filtered) so that, once this gets capped to 20 below, the
  // candidates that survive are the best matches rather than whatever happened
  // to come first in bootstrap's channel order.
  const localChannelMatches = createMemo<Channel[]>(() => {
    const q = query().trim();
    if (!q) return [];
    return fuzzySearch(bootstrap()?.channels ?? [], {
      query: q,
      text: (c) => c.name,
      frequency: (c) => frecencyScore(c.id),
    });
  });

  // The sidebar only knows channels you've already joined — on a large workspace,
  // most channels aren't in that list. Merge in a debounced live search (same
  // search.modules.channels-backed endpoint "Browse channels" uses) so jumping to
  // a channel you haven't joined yet works too, without ever fetching/caching the
  // full channel directory. Final ranking (by frecency) happens once, together
  // with people, in `rows` below — this just dedupes the candidate pool, capped
  // generously so a real high-frecency match doesn't get cut before that sort runs.
  const channelResults = createMemo<JumpChannel[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const joined = localChannelMatches().map(
      (c): JumpChannel => ({ id: c.id, name: c.name, private: c.private, joined: true }),
    );
    const joinedIds = new Set(joined.map((c) => c.id));
    const remote = remoteChannels()
      .filter((c) => !joinedIds.has(c.id))
      .map((c): JumpChannel => ({ id: c.id, name: c.name, private: c.private, joined: false }));
    return [...joined, ...remote].slice(0, 20);
  });

  // Same reasoning as localChannelMatches: rank before the 20-item cap below
  // picks which candidates make it into the final merge+rank.
  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim();
    if (!q) return [];
    const me = currentUser()?.id;
    return fuzzySearch(
      knownUsers().filter((u) => u.id !== me),
      { query: q, text: (u) => u.name, frequency: (u) => frecencyScore(u.id) },
    );
  });

  // Local matches are only whoever's already been resolved this session — merge
  // in a debounced org-wide search so "people" results aren't silently limited to
  // that. Final ranking (by frecency) happens once, together with channels, in `rows`.
  const peopleResults = createMemo<User[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const merged = new Map<string, User>();
    for (const u of localPeopleMatches()) merged.set(u.id, u);
    for (const u of remotePeople()) merged.set(u.id, u);
    return [...merged.values()].slice(0, 20);
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
      const found = await searchUsers(q, currentUser()?.id);
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

  // One flat, ranked list instead of separate headed sections — channels and
  // people ranked together, fuzzy text-match quality first so an exact/prefix
  // hit always beats a loose one (typos still surface via the fuzzy fallback).
  // Within a tier, a channel you've actually joined outranks one you're just
  // browsing (membership is a stronger signal than having previewed it once),
  // and frecency (frequency + recency of visits, the same signal the real
  // client's quick switcher uses its local jump-target database for) only
  // breaks ties *within* that, e.g. picking between two joined channels that
  // both start with the query. Actual message content search stays out of
  // this box entirely; "Search all messages for…" (rendered above the list)
  // is the only way to reach it.
  const rows = createMemo<Row[]>(() => {
    if (!hasQuery()) return [];
    const candidates: Candidate[] = [
      ...channelResults().map(
        (c): Candidate => ({ row: { kind: "channel", data: c }, name: c.name, id: c.id }),
      ),
      ...peopleResults().map(
        (u): Candidate => ({ row: { kind: "person", data: u }, name: u.name, id: u.id }),
      ),
    ];
    const ranked = fuzzySearch(candidates, {
      query: query(),
      text: (c) => c.name,
      priority: (c) => (c.row.kind === "channel" && !c.row.data.joined ? 0 : 1),
      frequency: (c) => frecencyScore(c.id),
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
    setActiveView({ kind: "channel", id: c.id });
    props.onClose();
  };

  const goToPerson = (userId: string) => {
    const dm = directMessages().find((d) => d.userId === userId);
    if (dm) setActiveView({ kind: "dm", id: dm.id });
    else openDmWithUser(userId);
    props.onClose();
  };

  const goToMessageSearch = () => {
    openMessageSearch(query());
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
      <div class="global-search-card">
        <div class="global-search-input-row">
          <Icon name="search" size={16} class="global-search-icon" />
          <input
            class="global-search-input"
            type="text"
            placeholder="Search channels, people…"
            value={query()}
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
            autofocus
          />
          <button type="button" class="panel-close-btn" onClick={props.onClose} title="Close">
            <Icon name="close" size={12} />
          </button>
        </div>

        <div class="global-search-results">
          <Show
            when={hasQuery()}
            fallback={<div class="global-search-hint">Jump to a channel or person. (Ctrl+K)</div>}
          >
            <button
              type="button"
              class="global-search-result global-search-message-action"
              classList={{ active: activeIndex() === 0 }}
              onClick={goToMessageSearch}
              onMouseEnter={() => setActiveIndex(0)}
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
                      type="button"
                      class="global-search-result global-search-jump"
                      classList={{ active: activeIndex() === itemIndex() }}
                      onClick={() => goToChannel(c)}
                      onMouseEnter={() => setActiveIndex(itemIndex())}
                    >
                      <span class="global-search-jump-icon">
                        {c.private ? <Icon name="lock" size={13} /> : "#"}
                      </span>
                      {c.name}
                    </button>
                  );
                }
                const u = row.data;
                return (
                  <button
                    type="button"
                    class="global-search-result global-search-jump"
                    classList={{ active: activeIndex() === itemIndex() }}
                    onClick={() => goToPerson(u.id)}
                    onMouseEnter={() => setActiveIndex(itemIndex())}
                  >
                    <Avatar user={u} size="small" />
                    {u.name}
                  </button>
                );
              }}
            </For>

            <Show when={rows().length === 0}>
              <div class="global-search-empty">
                No channels or people matched — try searching messages above.
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
