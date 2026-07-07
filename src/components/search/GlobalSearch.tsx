import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  bootstrap,
  directMessages,
  searchUsers,
  setActiveView,
  openDmWithUser,
  openMessageSearch,
  currentUser,
  joinChannelById,
  frecencyScore,
} from '../../lib/store';
import { fetchBrowsableChannels } from '../../lib/slackApi';
import type { BrowsableChannel, Channel, User } from '../../lib/types';
import Icon from '../../icons';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import './GlobalSearch.css';

interface JumpChannel {
  id: string;
  name: string;
  private: boolean;
  joined: boolean;
}

type Row =
  | { kind: 'channel'; data: JumpChannel }
  | { kind: 'person'; data: User };

// How well a name matches the typed query, low = better. This is the *primary*
// sort key (see `rows` below) — frecency alone previously decided ranking, so
// any channel/person with even a sliver of usage history could outrank a
// dead-on exact/prefix match with none. Tiers: exact, prefix, match right after
// a word boundary (so "general" ranks #general above #off-topic-general-chat
// ahead of e.g. "eneral-ish"), then anywhere else mid-word.
function matchRank(name: string, q: string): number {
  const lower = name.toLowerCase();
  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  const idx = lower.indexOf(q);
  if (idx > 0 && /[-_\s]/.test(lower[idx - 1])) return 2;
  return 3;
}

export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal('');
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
    return (bootstrap()?.channels ?? []).filter((c) => c.name.toLowerCase().includes(q));
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
    const joined = localChannelMatches().map((c): JumpChannel => ({ id: c.id, name: c.name, private: c.private, joined: true }));
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
    return (bootstrap()?.users ?? []).filter((u) => u.id !== me && u.name.toLowerCase().includes(q));
  });

  // The bootstrap user list is capped at 200 for payload size, which on a large
  // workspace covers a sliver of the org — merge in a debounced org-wide search
  // so "people" results aren't silently limited to whoever happened to load first.
  // Final ranking (by frecency) happens once, together with channels, in `rows`.
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
  // people ranked together, text-match quality first (see matchRank) so an
  // exact/prefix hit always beats a loose one, and frecency (frequency +
  // recency of visits, the same signal the real client's quick switcher uses
  // its local jump-target database for) only breaks ties *within* a match
  // tier, e.g. picking between two channels that both start with the query.
  // Actual message content search stays out of this box entirely; "Search all
  // messages for…" (rendered above the list) is the only way to reach it.
  const rows = createMemo<Row[]>(() => {
    if (!hasQuery()) return [];
    const q = query().trim().toLowerCase();
    type Ranked = { name: string; rank: number; score: number; row: Row };
    const ranked: Ranked[] = [
      ...channelResults().map((c): Ranked => ({ name: c.name, rank: matchRank(c.name, q), score: frecencyScore(c.id), row: { kind: 'channel', data: c } })),
      ...peopleResults().map((u): Ranked => ({ name: u.name, rank: matchRank(u.name, q), score: frecencyScore(u.id), row: { kind: 'person', data: u } })),
    ];
    ranked.sort((a, b) => {
      const rankDiff = a.rank - b.rank;
      if (rankDiff !== 0) return rankDiff;
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    });

    return ranked.slice(0, 8).map((r) => r.row);
  });

  const goToChannel = (c: JumpChannel) => {
    if (c.joined) {
      setActiveView({ kind: 'channel', id: c.id });
      props.onClose();
    } else {
      joinChannelById(c.id);
      props.onClose();
    }
  };

  const goToPerson = (userId: string) => {
    const dm = directMessages().find((d) => d.userId === userId);
    if (dm) setActiveView({ kind: 'dm', id: dm.id });
    else openDmWithUser(userId);
    props.onClose();
  };

  const goToMessageSearch = () => {
    openMessageSearch(query());
    props.onClose();
  };

  return (
    <div class="global-search-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
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
              if (e.key === 'Enter' && hasQuery()) goToMessageSearch();
            }}
            autofocus
          />
          <button class="global-search-close" onClick={props.onClose} title="Close">
            ✕
          </button>
        </div>

        <div class="global-search-results">
          <Show
            when={hasQuery()}
            fallback={<div class="global-search-hint">Jump to a channel or person. (Ctrl+K)</div>}
          >
            <button class="global-search-result global-search-jump global-search-message-action" onClick={goToMessageSearch}>
              <span class="global-search-jump-icon">
                <Icon name="search" size={13} />
              </span>
              Search all messages for "{query()}"
            </button>

            <For each={rows()}>
              {(row) => {
                if (row.kind === 'channel') {
                  const c = row.data;
                  return (
                    <button class="global-search-result global-search-jump" onClick={() => goToChannel(c)}>
                      <span class="global-search-jump-icon">{c.private ? <Icon name="lock" size={13} /> : '#'}</span>
                      {c.name}
                    </button>
                  );
                }
                const u = row.data;
                return (
                  <button class="global-search-result global-search-jump" onClick={() => goToPerson(u.id)}>
                    <span class="global-search-avatar" style={{ background: u.avatarColor }}>
                      <Show when={u.avatarUrl} fallback={u.initials}>
                        {(url) => <img src={url()} alt="" />}
                      </Show>
                    </span>
                    {u.name}
                  </button>
                );
              }}
            </For>

            <Show when={rows().length === 0}>
              <div class="global-search-empty">No channels or people matched — try searching messages above.</div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
