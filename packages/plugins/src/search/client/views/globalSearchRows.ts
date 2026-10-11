import { service } from "@slock/core/solid";
import type {
  Channel,
  DirectMessage,
  GlobalSearchResults as SearchResults,
  User,
} from "@slock/types";
import { fuzzySearch } from "@slock/ui";
import { createMemo } from "solid-js";
import "./GlobalSearch.css";
import type { GlobalSearchRow } from "./GlobalSearchResults";

const bootstrapStore = service("bootstrap");
const viewStore = service("conversations");
const dmsStore = service("dms");
const titles = service("titles");
const usersStore = service("users");
const prefsStore = service("prefs");

export const MAX_ROWS = 30;
type Candidate = { row: GlobalSearchRow; name: string; id: string };

export function createGlobalSearchRows(deps: {
  hasQuery: () => boolean;
  query: () => string;
  remoteResults: () => SearchResults;
}) {
  const { hasQuery, query, remoteResults } = deps;
  const localChannelMatches = createMemo<Channel[]>(() => {
    const q = query().trim();
    if (!q) return [];
    return fuzzySearch(bootstrapStore.bootstrap.data?.channels ?? [], {
      frequency: (c) => prefsStore.frecencyScore(c.id),
      query: q,
      text: (c) => c.name,
    });
  });
  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim();
    if (!q) return [];
    const me = usersStore.currentUser()?.id;
    return fuzzySearch(
      usersStore.knownUsers().filter((u) => u.id !== me),
      { frequency: (u) => prefsStore.frecencyScore(u.id), query: q, text: (u) => u.name },
    );
  });

  const mpdmResults = createMemo<DirectMessage[]>(() => {
    const q = query().trim();
    if (!q) return [];
    const mpdms = dmsStore.directMessages().filter((dm) => dm.memberIds);
    return fuzzySearch(mpdms, {
      frequency: (dm) => prefsStore.frecencyScore(dm.id),
      query: q,
      text: (dm) => titles.title(dm.id),
    });
  });
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
          name: titles.title(dm.id),
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
      frequency: (c) => prefsStore.frecencyScore(c.id),
      priority: (c) => (c.row.kind === "channel" && !c.row.data.joined ? 0 : 1),
      query: query(),
      text: (c) => c.name,
    });
    return ranked.slice(0, MAX_ROWS).map((c) => c.row);
  });
  const recentRows = createMemo<GlobalSearchRow[]>(() => {
    const activeId = viewStore.activeView()?.id;
    const channels = new Map((bootstrapStore.bootstrap.data?.channels ?? []).map((c) => [c.id, c]));
    const dms = new Map(dmsStore.directMessages().map((dm) => [dm.id, dm]));
    const recent: GlobalSearchRow[] = [];
    for (const id of prefsStore.recentIds()) {
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
  return { computedRows, recentRows };
}
