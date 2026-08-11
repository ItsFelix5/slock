import { fetchDrafts, saveDraft } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { createDraftPersistenceGate, saveAfterDraftHydration } from "./draftSync/draftSyncGuards";
import { draftCacheKey } from "./submission";

export const drafts: Record<string, string> = {};
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
        if (!locallyTouchedKeys.has(key)) drafts[key] = draft.text;
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
): Promise<void> {
  const previous = draftSaveQueues.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const saved = await saveAfterDraftHydration(hydrateDrafts, () =>
        saveDraft(channelId, threadTs, text),
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

export function cacheDraftLocally(channelId: string, threadTs: string | undefined, text: string) {
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  drafts[key] = text;
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
  loadIntoEditor: (text: string) => void;
  resetPreviews: () => void;
  setText: (text: string) => void;
  text: () => string;
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
    const value = (key && drafts[key]) || "";
    if (value === opts.text()) return;
    opts.setText(value);
    opts.loadIntoEditor(value);
    opts.resetPreviews();
  });

  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    const channelId = opts.channelId();
    if (!(key && channelId)) return;
    const value = opts.text();
    // A channel switch or hydration populates the editor programmatically.
    // Treat that first observed value as the baseline, not as a user edit;
    // otherwise an empty baseline after a failed list request can delete a
    // server draft as soon as the retry discovers its id.
    if (!persistenceGate.shouldPersist(key)) return;
    if (value.trim()) drafts[key] = value;
    else delete drafts[key];
    persistDraft(channelId, opts.threadTs(), value);
  });

  return {
    cacheLocal() {
      const channelId = opts.channelId();
      if (channelId) cacheDraftLocally(channelId, opts.threadTs(), opts.text());
    },
    retrySync() {
      const key = opts.key();
      const channelId = opts.channelId();
      if (!(key && channelId)) return Promise.resolve();
      const value = opts.text();
      cacheDraftLocally(channelId, opts.threadTs(), value);
      return enqueueDraftSave(key, channelId, opts.threadTs(), value);
    },
    syncError() {
      const channelId = opts.channelId();
      return channelId ? hasDraftSyncError(channelId, opts.threadTs()) : false;
    },
  };
}

// Debounced so a debounce-free character-by-character sync doesn't spam
// drafts.create — Slack's own draft round-trip only needs to be roughly
// current, not live.
export function persistDraft(channelId: string, threadTs: string | undefined, text: string) {
  const key = draftCacheKey(channelId, threadTs);
  const pending = draftSaveTimers.get(key);
  if (pending) clearTimeout(pending);
  draftSaveTimers.set(
    key,
    setTimeout(() => {
      draftSaveTimers.delete(key);
      enqueueDraftSave(key, channelId, threadTs, text);
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
