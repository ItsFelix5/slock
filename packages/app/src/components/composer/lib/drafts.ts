import { fetchDrafts, saveDraft } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { createDraftPersistenceGate, saveAfterDraftHydration } from "./draftSync/draftSyncGuards";
import { draftCacheKey } from "./submission";

type DraftValue = { text: string; blocks?: unknown };

export const drafts: Record<string, DraftValue> = {};
const [draftsReady, setDraftsReady] = createSignal(false);
const [draftErrorKeys, setDraftErrorKeys] = createSignal<Set<string>>(new Set());
const locallyTouchedKeys = new Set<string>();
let draftsHydrated = false;
let draftHydrationPromise: Promise<boolean> | null = null;

export { draftsReady };

function hydrateDrafts(): Promise<boolean> {
  if (draftsHydrated) return Promise.resolve(true);
  if (draftHydrationPromise) return draftHydrationPromise;

  const request = fetchDrafts()
    .then((entries) => {
      for (const draft of entries) {
        const key = draftCacheKey(draft.channelId, draft.threadTs);
        if (!locallyTouchedKeys.has(key)) drafts[key] = { blocks: draft.blocks, text: draft.text };
      }
      draftsHydrated = true;
      setDraftError("hydrate", false);
      return true;
    })
    .catch(() => {
      setDraftError("hydrate", true);
      return false;
    })
    .finally(() => {
      setDraftsReady(true);
      if (draftHydrationPromise === request) draftHydrationPromise = null;
    });
  draftHydrationPromise = request;
  return request;
}

const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const draftSaveQueues = new Map<string, Promise<void>>();

function setDraftError(key: string, failed: boolean) {
  setDraftErrorKeys((keys) => {
    if (failed === keys.has(key) && (failed || !keys.has("hydrate"))) return keys;
    const next = new Set(keys);
    if (failed) next.add(key);
    else {
      next.delete(key);
      next.delete("hydrate");
    }
    return next;
  });
}

function enqueueDraftSave(
  key: string,
  channelId: string,
  threadTs: string | undefined,
  text: string,
  blocks?: unknown,
): Promise<void> {
  const previous = draftSaveQueues.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const saved = await saveAfterDraftHydration(hydrateDrafts, () =>
        saveDraft(channelId, threadTs, text, blocks),
      );
      if (!saved) throw new Error("Draft hydration failed");
    })
    .then(
      () => setDraftError(key, false),
      () => {
        setDraftError(key, true);
      },
    );
  draftSaveQueues.set(key, next);
  void next.finally(() => {
    if (draftSaveQueues.get(key) === next) draftSaveQueues.delete(key);
  });
  return next;
}

export function cacheDraftLocally(
  channelId: string,
  threadTs: string | undefined,
  text: string,
  blocks?: unknown,
) {
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  drafts[key] = { blocks, text };
}

export function clearCachedDraft(channelId: string, threadTs?: string) {
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  delete drafts[key];
}

export function hasDraftSyncError(channelId: string, threadTs?: string): boolean {
  const errors = draftErrorKeys();
  return errors.has("hydrate") || errors.has(draftCacheKey(channelId, threadTs));
}

export function createComposerDraftState(opts: {
  channelId: () => string | undefined;
  editing: () => boolean;
  key: () => string | undefined;
  loadIntoEditor: (text: string, blocks?: unknown) => void;
  resetPreviews: () => void;
  setText: (text: string) => void;
  text: () => string;
  /** The composer's current blocks, saved and restored alongside `text` — undefined for a
   * plain-text-only draft (matches `docToBlocks`'s "empty doc → no blocks" convention). */
  blocks?: () => unknown;
  threadTs: () => string | undefined;
}) {
  let loadedKey: string | undefined;
  const persistenceGate = createDraftPersistenceGate();
  createEffect(() => {
    if (opts.editing() || !opts.channelId()) return;
    void hydrateDrafts();
  });
  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    if (key === loadedKey) return;
    loadedKey = key;
    const value = (key && drafts[key]) || { text: "" };
    if (value.text === opts.text()) return;
    opts.setText(value.text);
    opts.loadIntoEditor(value.text, value.blocks);
    opts.resetPreviews();
  });

  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    const channelId = opts.channelId();
    if (!(key && channelId)) return;
    const value = opts.text();
    const blocks = opts.blocks?.();

    if (!persistenceGate.shouldPersist(key)) return;
    if (value.trim()) drafts[key] = { blocks, text: value };
    else delete drafts[key];
    persistDraft(channelId, opts.threadTs(), value, blocks);
  });

  return {
    cacheLocal() {
      const channelId = opts.channelId();
      if (channelId) cacheDraftLocally(channelId, opts.threadTs(), opts.text(), opts.blocks?.());
    },
    retrySync() {
      const key = opts.key();
      const channelId = opts.channelId();
      if (!(key && channelId)) return Promise.resolve();
      const value = opts.text();
      const blocks = opts.blocks?.();
      cacheDraftLocally(channelId, opts.threadTs(), value, blocks);
      return enqueueDraftSave(key, channelId, opts.threadTs(), value, blocks);
    },
    syncError() {
      const channelId = opts.channelId();
      return channelId ? hasDraftSyncError(channelId, opts.threadTs()) : false;
    },
  };
}

export function persistDraft(
  channelId: string,
  threadTs: string | undefined,
  text: string,
  blocks?: unknown,
) {
  const key = draftCacheKey(channelId, threadTs);
  const pending = draftSaveTimers.get(key);
  if (pending) clearTimeout(pending);
  draftSaveTimers.set(
    key,
    setTimeout(() => {
      draftSaveTimers.delete(key);
      enqueueDraftSave(key, channelId, threadTs, text, blocks);
    }, 1000),
  );
}

export function clearPersistedDraft(channelId: string, threadTs?: string) {
  const key = draftCacheKey(channelId, threadTs);
  const pending = draftSaveTimers.get(key);
  if (pending) clearTimeout(pending);
  draftSaveTimers.delete(key);
  clearCachedDraft(channelId, threadTs);
  enqueueDraftSave(key, channelId, threadTs, "");
}
