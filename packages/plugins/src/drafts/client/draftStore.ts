import { compareTs, isSlackError } from "@slock/slack";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js";
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

  function upsert(entry: DraftEntry) {
    if (entry.lastUpdatedTs) lastKnownTs.set(entry.id, entry.lastUpdatedTs);
    setDrafts(draftCacheKey(entry.channelId, entry.threadTs), (list = []) => {
      const idx = list.findIndex((e) => e.id === entry.id);
      return idx === -1 ? [...list, entry] : list.map((e, i) => (i === idx ? entry : e));
    });
  }

  function remove(key: string, id: string) {
    const next = drafts[key]?.filter((e) => e.id !== id);
    setDrafts(
      produce((all) => {
        if (next?.length) all[key] = next;
        else delete all[key];
      }),
    );
  }

  function applyRemote(draft: DraftEntry) {
    if (!hydrated) return;
    const key = draftCacheKey(draft.channelId, draft.threadTs);
    const known = drafts[key]?.find((e) => e.id === draft.id);
    if (known && !isNewerDraft(draft, known)) return;
    upsert(draft);
  }

  function removeRemote(id: string) {
    for (const [key, list] of Object.entries(drafts)) {
      if (list.some((e) => e.id === id)) remove(key, id);
    }
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
    upsert({ blocks, channelId, clientMsgId, id: result.id, lastUpdatedTs: result.lastUpdatedTs, threadTs });
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
