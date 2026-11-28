import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import { compareTs, isSlackError } from "@slock/slack";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { createStore } from "solid-js";
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
  const touchedKeys = new Set<string>();
  const lastKnownTs = new Map<string, Ts>();
  const removedIds = new Set<string>();
  const unsaved = new Map<string, Block[]>();

  const serverList = defineQuery<null, DraftEntry[]>({
    gcMs: Number.POSITIVE_INFINITY,
    load: async (_, { signal }) => {
      const entries = await fetchDrafts(signal);
      for (const draft of entries) {
        if (!touchedKeys.has(draftCacheKey(draft.channelId, draft.threadTs))) upsert(draft);
      }
      return entries;
    },
    name: "drafts",
    retry: { retries: 0 },
    revalidates: false,
  });

  const writes = defineMutation<{ key: string; task: () => Promise<void> }>({
    key: ({ key }) => key,
    mode: "queue",
    onError: (error) => console.error("Failed to write draft", error),
    run: ({ task }) => task(),
  });

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
    removedIds.add(id);
    setDrafts((all) => {
      const next = all[key]?.filter((e) => e.id !== id);
      if (next?.length) all[key] = next;
      else delete all[key];
    });
  }

  function applyRemote(draft: DraftEntry) {
    if (serverList.read(null) && !removedIds.has(draft.id)) write(draft, true);
  }

  function removeRemote(id: string) {
    removedIds.add(id);
    setDrafts((all) => {
      for (const [key, list] of Object.entries(all)) {
        const next = list.filter((e) => e.id !== id);
        if (next.length === list.length) continue;
        if (next.length) all[key] = next;
        else delete all[key];
      }
    });
  }

  async function enqueue(key: string, task: () => Promise<void>): Promise<void> {
    await writes.run({ key, task });
  }

  function deleteOnServer(id: string): Promise<void> {
    return deleteDraft(id, lastKnownTs.get(id));
  }

  async function deleteNow(key: string, id: string) {
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
    return serverList.ensure(null).then(
      () => true,
      (error: unknown) => {
        if (!isSlackError(error)) console.error("Failed to load drafts", error);
        return false;
      },
    );
  }

  function ready(): boolean {
    const { failures, status } = serverList.entry(null);
    return status === "ready" || failures > 0;
  }

  async function seed(channelId: ChannelId, threadTs: Ts | undefined, text: string) {
    if (!text.trim()) return false;
    touchedKeys.add(draftCacheKey(channelId, threadTs));
    if (!(await hydrate())) return false;
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
    return true;
  }

  return {
    applyRemote,
    channelHasDraft,
    deleteEntry: (key: string, id: string) => enqueue(key, () => deleteNow(key, id)),
    deleteNow,
    deleteOnServer,
    drafts,
    draftsForChannel,
    enqueue,
    hydrate,
    ready,
    remove,
    removeRemote,
    seed,
    settled: (key: string) => (writes.pending(key) ? enqueue(key, async () => {}) : undefined),
    touch: (key: string) => touchedKeys.add(key),
    unsaved,
    upsert,
  };
}
