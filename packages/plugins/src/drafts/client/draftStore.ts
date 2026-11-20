import { compareTs, isSlackError } from "@slock/slack";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { createSignal, createStore } from "solid-js";
import { deleteDraft, fetchDrafts, saveDraft } from "./draftApi";

export function draftCacheKey(channelId: ChannelId, threadTs?: Ts): string {
  return threadTs ? `${channelId}:thread:${threadTs}` : channelId;
}

export function isNewerDraft(candidate: DraftEntry, known: DraftEntry): boolean {
  if (!candidate.lastUpdatedTs) return false;
  return !known.lastUpdatedTs || compareTs(candidate.lastUpdatedTs, known.lastUpdatedTs) === 1;
}

export type DraftStore = ReturnType<typeof createDraftStore>;

export function createDraftStore() {
  const [drafts, setDrafts] = createStore<Record<string, DraftEntry[]>>({});
  const [ready, setReady] = createSignal(false);
  const touchedKeys = new Set<string>();
  const lastKnownTs = new Map<string, Ts>();
  let hydrated = false;
  let hydration: Promise<boolean> | null = null;
  let disposed = false;

  function write(entry: DraftEntry, onlyIfNewer: boolean): boolean {
    const key = draftCacheKey(entry.channelId, entry.threadTs);
    let applied = false;
    setDrafts((all) => {
      all[key] ??= [];
      const list = all[key] ?? [];
      const index = list.findIndex((e) => e.id === entry.id);
      const known = list[index];
      if (known && onlyIfNewer && !isNewerDraft(entry, known)) return;
      if (index === -1) list.push(entry);
      else list[index] = entry;
      applied = true;
    });
    if (applied && entry.lastUpdatedTs) lastKnownTs.set(entry.id, entry.lastUpdatedTs);
    return applied;
  }

  const upsert = (entry: DraftEntry) => void write(entry, false);

  function remove(key: string, id: string) {
    setDrafts((all) => {
      const next = all[key]?.filter((e) => e.id !== id);
      if (next?.length) all[key] = next;
      else delete all[key];
    });
  }

  function applyRemote(draft: DraftEntry) {
    if (hydrated) write(draft, true);
  }

  function removeRemote(id: string) {
    setDrafts((all) => {
      for (const [key, list] of Object.entries(all)) {
        const next = list.filter((e) => e.id !== id);
        if (next.length === list.length) continue;
        if (next.length) all[key] = next;
        else delete all[key];
      }
    });
  }

  function deleteOnServer(id: string): Promise<void> {
    return deleteDraft(id, lastKnownTs.get(id));
  }

  async function deleteEntry(key: string, id: string) {
    touchedKeys.add(key);
    await deleteOnServer(id);
    remove(key, id);
  }

  function channelHasDraft(channelId: ChannelId): boolean {
    return Object.values(drafts).some((list) => list.some((e) => e.channelId === channelId));
  }

  function draftsForChannel(channelId: ChannelId): (DraftEntry & { key: string })[] {
    return Object.entries(drafts).flatMap(([key, list]) =>
      list.filter((e) => e.channelId === channelId).map((entry) => ({ ...entry, key })),
    );
  }

  function hydrate(): Promise<boolean> {
    if (hydrated) return Promise.resolve(true);
    if (hydration) return hydration;
    const request = fetchDrafts()
      .then((entries) => {
        if (disposed) return false;
        for (const draft of entries) {
          if (!touchedKeys.has(draftCacheKey(draft.channelId, draft.threadTs))) upsert(draft);
        }
        hydrated = true;
        return true;
      })
      .catch((error: unknown) => {
        if (!isSlackError(error)) throw error;
        return false;
      })
      .finally(() => {
        if (disposed) return;
        setReady(true);
        if (hydration === request) hydration = null;
      });
    hydration = request;
    return request;
  }

  async function seed(channelId: ChannelId, threadTs: Ts | undefined, text: string) {
    if (!text.trim()) return;
    touchedKeys.add(draftCacheKey(channelId, threadTs));
    if (!(await hydrate())) return;
    const clientMsgId = crypto.randomUUID();
    const blocks: Block[] = [
      {
        elements: [{ elements: [{ text, type: "text" }], type: "rich_text_section" }],
        type: "rich_text",
      },
    ];
    const result = await saveDraft(channelId, threadTs, blocks, undefined, clientMsgId);
    upsert({
      blocks,
      channelId,
      clientMsgId,
      id: result.id,
      lastUpdatedTs: result.lastUpdatedTs,
      threadTs,
    });
  }

  return {
    applyRemote,
    channelHasDraft,
    deleteEntry,
    deleteOnServer,
    dispose() {
      disposed = true;
    },
    drafts,
    draftsForChannel,
    hydrate,
    ready,
    remove,
    removeRemote,
    seed,
    touch: (key: string) => touchedKeys.add(key),
    upsert,
  };
}
