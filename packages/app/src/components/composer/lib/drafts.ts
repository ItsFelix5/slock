import { createEffect, createSignal } from "solid-js";
import { fetchDrafts, saveDraft } from "../../../lib/api";

export function draftCacheKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:thread:${threadTs}` : channelId;
}

type DraftValue = { text: string; blocks?: unknown };

const pendingFilesByDraft = new Map<string, File[]>();

export function createPendingFileState(opts: {
  disabled: () => boolean;
  draftKey: () => string | undefined;
}) {
  const [files, setFiles] = createSignal<File[]>([]);
  let loadedKey: string | undefined;

  createEffect(() => {
    const key = opts.draftKey();
    if (key === loadedKey) return;
    loadedKey = key;
    setFiles(key ? (pendingFilesByDraft.get(key) ?? []) : []);
  });

  const store = (next: File[]) => {
    setFiles(next);
    const key = opts.draftKey();
    if (!key) return;
    if (next.length > 0) pendingFilesByDraft.set(key, next);
    else pendingFilesByDraft.delete(key);
  };

  return {
    add(fileList: FileList | File[]) {
      if (opts.disabled()) return;
      store([...files(), ...Array.from(fileList)]);
    },
    clear(submittedKey: string) {
      pendingFilesByDraft.delete(submittedKey);
      if (opts.draftKey() === submittedKey) setFiles([]);
    },
    files,
    remove(index: number) {
      if (opts.disabled()) return;
      store(files().filter((_, currentIndex) => currentIndex !== index));
    },
    rename(index: number, name: string) {
      if (opts.disabled()) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      store(
        files().map((file, currentIndex) =>
          currentIndex === index && trimmed !== file.name
            ? new File([file], trimmed, { lastModified: file.lastModified, type: file.type })
            : file,
        ),
      );
    },
  };
}

export const drafts: Record<string, DraftValue> = {};
const [draftsReady, setDraftsReady] = createSignal(false);
const [draftErrorKeys, setDraftErrorKeys] = createSignal<Set<string>>(new Set());
const [draftsVersion, setDraftsVersion] = createSignal(0);
const locallyTouchedKeys = new Set<string>();
let draftsHydrated = false;
let draftHydrationPromise: Promise<boolean> | null = null;

export { draftsReady };

function setDraft(key: string, value: DraftValue) {
  drafts[key] = value;
  setDraftsVersion((v) => v + 1);
}

function removeDraft(key: string) {
  delete drafts[key];
  setDraftsVersion((v) => v + 1);
}

export function channelHasDraft(channelId: string): boolean {
  draftsVersion();
  if (drafts[channelId]?.text.trim()) return true;
  const threadPrefix = `${channelId}:thread:`;
  for (const key in drafts) {
    if (key.startsWith(threadPrefix) && drafts[key]?.text.trim()) return true;
  }
  return false;
}

function hydrateDrafts(): Promise<boolean> {
  if (draftsHydrated) return Promise.resolve(true);
  if (draftHydrationPromise) return draftHydrationPromise;

  const request = fetchDrafts()
    .then((entries) => {
      for (const draft of entries) {
        const key = draftCacheKey(draft.channelId, draft.threadTs);
        if (!locallyTouchedKeys.has(key)) setDraft(key, { blocks: draft.blocks, text: draft.text });
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
      if (!(await hydrateDrafts())) throw new Error("Draft hydration failed");
      await saveDraft(channelId, threadTs, text, blocks);
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
  setDraft(key, { blocks, text });
}

export function clearCachedDraft(channelId: string, threadTs?: string) {
  const key = draftCacheKey(channelId, threadTs);
  locallyTouchedKeys.add(key);
  removeDraft(key);
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
  blocks?: () => unknown;
  threadTs: () => string | undefined;
}) {
  let loadedKey: string | undefined;
  let persistedKey: string | undefined;
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

    const skip = key !== persistedKey;
    persistedKey = key;
    if (skip) return;
    if (value.trim()) setDraft(key, { blocks, text: value });
    else removeDraft(key);
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

export function clearPersistedDraft(
  channelId: string,
  threadTs: string | undefined,
  pendingFiles: { clear: (key: string) => void },
) {
  const key = draftCacheKey(channelId, threadTs);
  const pending = draftSaveTimers.get(key);
  if (pending) clearTimeout(pending);
  draftSaveTimers.delete(key);
  clearCachedDraft(channelId, threadTs);
  enqueueDraftSave(key, channelId, threadTs, "");
  pendingFiles.clear(key);
}
