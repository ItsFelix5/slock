import type { Block } from "@slock/types";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { deleteDraft, fetchDrafts, saveDraft } from "../../../lib/api";

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
  text: string;
  blocks?: Block[];
  lastUpdatedTs?: string;
};

export const drafts: Record<string, DraftValue[]> = {};
const [draftsReady, setDraftsReady] = createSignal(false);
export const locallyTouchedKeys = new Set<string>();
let draftsHydrated = false;
let draftHydrationPromise: Promise<boolean> | null = null;

export { draftsReady };

const draftKeysByChannel = new Map<string, Set<string>>();
const [channelDraftFlags, setChannelDraftFlags] = createStore<Record<string, boolean>>({});

function updateChannelDraftFlag(key: string, hasEntries: boolean) {
  const { channelId } = keyToTarget(key);
  let keys = draftKeysByChannel.get(channelId);
  if (hasEntries) {
    if (!keys) {
      keys = new Set();
      draftKeysByChannel.set(channelId, keys);
    }
    keys.add(key);
  } else if (keys) {
    keys.delete(key);
    if (keys.size === 0) draftKeysByChannel.delete(channelId);
  }
  const has = (draftKeysByChannel.get(channelId)?.size ?? 0) > 0;
  if (channelDraftFlags[channelId] !== has) setChannelDraftFlags(channelId, has);
}

export function upsertEntry(key: string, entry: DraftValue) {
  const list = drafts[key] ?? [];
  const idx = list.findIndex((e) => e.id === entry.id);
  drafts[key] = idx === -1 ? [...list, entry] : list.map((e, i) => (i === idx ? entry : e));
  updateChannelDraftFlag(key, drafts[key].length > 0);
}

export function removeEntry(key: string, id: string) {
  const list = drafts[key];
  if (!list) return;
  const next = list.filter((e) => e.id !== id);
  if (next.length) drafts[key] = next;
  else delete drafts[key];
  updateChannelDraftFlag(key, next.length > 0);
}

export async function deleteEntry(key: string, id: string) {
  locallyTouchedKeys.add(key);
  await deleteDraft(id);
  removeEntry(key, id);
}

export function channelHasDraft(channelId: string): boolean {
  return !!channelDraftFlags[channelId];
}

export function draftsForChannel(
  channelId: string,
): (DraftValue & { key: string; threadTs?: string })[] {
  void channelDraftFlags[channelId];
  const keys = draftKeysByChannel.get(channelId);
  if (!keys) return [];
  const out: (DraftValue & { key: string; threadTs?: string })[] = [];
  for (const key of keys) {
    const { threadTs } = keyToTarget(key);
    for (const entry of drafts[key] ?? []) out.push({ ...entry, key, threadTs });
  }
  return out;
}

export function hydrateDrafts(): Promise<boolean> {
  if (draftsHydrated) return Promise.resolve(true);
  if (draftHydrationPromise) return draftHydrationPromise;

  const request = fetchDrafts()
    .then((entries) => {
      for (const draft of entries) {
        const key = draftCacheKey(draft.channelId, draft.threadTs);
        if (locallyTouchedKeys.has(key)) continue;
        upsertEntry(key, {
          blocks: draft.blocks,
          clientMsgId: draft.clientMsgId,
          id: draft.id,
          lastUpdatedTs: draft.lastUpdatedTs,
          text: draft.text,
        });
      }
      draftsHydrated = true;
      return true;
    })
    .catch(() => false)
    .finally(() => {
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
  blocks?: Block[],
): Promise<void> {
  if (!text.trim()) return;
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  if (!(await hydrateDrafts())) return;
  const clientMsgId = crypto.randomUUID();
  const result = await saveDraft(channelId, threadTs, text, blocks, undefined, clientMsgId);
  upsertEntry(key, {
    blocks,
    clientMsgId,
    id: result.id,
    lastUpdatedTs: result.lastUpdatedTs,
    text,
  });
}
