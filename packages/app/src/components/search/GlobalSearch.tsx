import type { BrowsableChannel, Channel, User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { Avatar, fuzzyMatch, fuzzySearch, Icon, Overlay, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  bootstrap,
  currentUser,
  directMessages,
  frecencyScore,
  joinChannelById,
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

export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal("");
  const [remotePeople, setRemotePeople] = createSignal<User[]>([]);
  const [remoteChannels, setRemoteChannels] = createSignal<BrowsableChannel[]>([]);
  let peopleDebounce: ReturnType<typeof setTimeout> | undefined;
  let peopleRequestId = 0;
  let channelDebounce: ReturnType<typeof setTimeout> | undefined;
  let channelRequestId = 0;

  useEscapeClose(props.onClose);

  const hasQuery = createMemo(() => !!query().trim());

  const localChannelMatches = createMemo<Channel[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    return (bootstrap()?.channels ?? []).filter((c) => fuzzyMatch(c.name, q) !== null);
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

  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const me = currentUser()?.id;
    return knownUsers().filter((u) => u.id !== me && fuzzyMatch(u.name, q) !== null);
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
  // hit always beats a loose one (typos still surface via the fuzzy fallback),
  // and frecency (frequency + recency of visits, the same signal the real
  // client's quick switcher uses its local jump-target database for) only
  // breaks ties *within* a match tier, e.g. picking between two channels that
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
      frequency: (c) => frecencyScore(c.id),
    });
    return ranked.slice(0, 8).map((c) => c.row);
  });

  const goToChannel = (c: JumpChannel) => {
    if (c.joined) {
      setActiveView({ kind: "channel", id: c.id });
      props.onClose();
    } else {
      joinChannelById(c.id);
      props.onClose();
    }
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
              runPeopleSearch();
              runChannelSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hasQuery()) goToMessageSearch();
            }}
            autofocus
          />
          <button type="button" class="panel-close-btn" onClick={props.onClose} title="Close">
            ✕
          </button>
        </div>

        <div class="global-search-results">
          <Show
            when={hasQuery()}
            fallback={<div class="global-search-hint">Jump to a channel or person. (Ctrl+K)</div>}
          >
            <button
              type="button"
              class="global-search-result global-search-jump global-search-message-action"
              onClick={goToMessageSearch}
            >
              <span class="global-search-jump-icon">
                <Icon name="search" size={13} />
              </span>
              Search all messages for "{query()}"
            </button>

            <For each={rows()}>
              {(row) => {
                if (row.kind === "channel") {
                  const c = row.data;
                  return (
                    <button
                      type="button"
                      class="global-search-result global-search-jump"
                      onClick={() => goToChannel(c)}
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
                    onClick={() => goToPerson(u.id)}
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
