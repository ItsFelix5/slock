import type { Block, DraftEntry } from "@slock/types";
import { createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { deleteDraft, fetchDrafts, saveDraft } from "../../slack/client/api/drafts";

export function draftCacheKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:thread:${threadTs}` : channelId;
}

export function keyToTarget(key: string): { channelId: string; threadTs?: string } {
  const idx = key.indexOf(":thread:");
  return idx === -1
    ? { channelId: key }
    : { channelId: key.slice(0, idx), threadTs: key.slice(idx + ":thread:".length) };
}

export type DraftValue = {
  id: string;
  clientMsgId: string;
  blocks: Block[];
  lastUpdatedTs?: string;
};

const [drafts, setDrafts] = createStore<Record<string, DraftValue[]>>({});
const [draftsReady, setDraftsReady] = createSignal(false);
export const locallyTouchedKeys = new Set<string>();
let draftsHydrated = false;
let draftHydrationPromise: Promise<boolean> | null = null;
let generation = 0;

export { drafts, draftsReady };

export function resetDrafts() {
  generation += 1;
  setDrafts(reconcile({}));
  setDraftsReady(false);
  locallyTouchedKeys.clear();
  draftsHydrated = false;
  draftHydrationPromise = null;
}

export function upsertEntry(key: string, entry: DraftValue) {
  setDrafts(key, (list = []) => {
    const idx = list.findIndex((e) => e.id === entry.id);
    return idx === -1 ? [...list, entry] : list.map((e, i) => (i === idx ? entry : e));
  });
}

export function removeEntry(key: string, id: string) {
  const next = drafts[key]?.filter((e) => e.id !== id);
  setDrafts(
    produce((all) => {
      if (next?.length) all[key] = next;
      else delete all[key];
    }),
  );
}

export function applyRemoteDraft(draft: DraftEntry) {
  if (!draftsHydrated) return;
  const key = draftCacheKey(draft.channelId, draft.threadTs);
  const known = drafts[key]?.find((e) => e.id === draft.id);
  if (known && Number(known.lastUpdatedTs ?? 0) >= Number(draft.lastUpdatedTs ?? 0)) return;
  upsertEntry(key, {
    blocks: draft.blocks,
    clientMsgId: draft.clientMsgId,
    id: draft.id,
    lastUpdatedTs: draft.lastUpdatedTs,
  });
}

export function removeRemoteDraft(id: string) {
  for (const [key, list] of Object.entries(drafts)) {
    if (list.some((e) => e.id === id)) removeEntry(key, id);
  }
}

export async function deleteEntry(key: string, id: string) {
  locallyTouchedKeys.add(key);
  await deleteDraft(id, drafts[key]?.find((e) => e.id === id)?.lastUpdatedTs);
  removeEntry(key, id);
}

export function channelHasDraft(channelId: string): boolean {
  return Object.keys(drafts).some((key) => keyToTarget(key).channelId === channelId);
}

export function draftsForChannel(
  channelId: string,
): (DraftValue & { key: string; threadTs?: string })[] {
  return Object.keys(drafts).flatMap((key) => {
    const { channelId: keyChannelId, threadTs } = keyToTarget(key);
    if (keyChannelId !== channelId) return [];
    return (drafts[key] ?? []).map((entry) => ({ ...entry, key, threadTs }));
  });
}

export function hydrateDrafts(): Promise<boolean> {
  if (draftsHydrated) return Promise.resolve(true);
  if (draftHydrationPromise) return draftHydrationPromise;

  const startedAt = generation;
  const request = fetchDrafts()
    .then((entries) => {
      if (startedAt !== generation) return false;
      for (const draft of entries) {
        const key = draftCacheKey(draft.channelId, draft.threadTs);
        if (locallyTouchedKeys.has(key)) continue;
        upsertEntry(key, {
          blocks: draft.blocks,
          clientMsgId: draft.clientMsgId,
          id: draft.id,
          lastUpdatedTs: draft.lastUpdatedTs,
        });
      }
      draftsHydrated = true;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      if (startedAt !== generation) return;
      setDraftsReady(true);
      if (draftHydrationPromise === request) draftHydrationPromise = null;
    });
  draftHydrationPromise = request;
  return request;
}

export async function seedDraft(
  channelId: string,
  threadTs: string | undefined,
  text: string,
): Promise<void> {
  if (!text.trim()) return;
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  if (!(await hydrateDrafts())) return;
  const clientMsgId = crypto.randomUUID();
  const blocks: Block[] = [
    {
      elements: [{ elements: [{ text, type: "text" }], type: "rich_text_section" }],
      type: "rich_text",
    },
  ];
  const result = await saveDraft(channelId, threadTs, blocks, undefined, clientMsgId);
  upsertEntry(key, {
    blocks,
    clientMsgId,
    id: result.id,
    lastUpdatedTs: result.lastUpdatedTs,
  });
}
