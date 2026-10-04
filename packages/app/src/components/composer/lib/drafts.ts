import type { Block } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { deleteDraft, saveDraft } from "../../../lib/api";
import {
  type DraftValue,
  deleteEntry,
  draftCacheKey,
  drafts,
  draftsReady,
  hydrateDrafts,
  locallyTouchedKeys,
  removeEntry,
  upsertEntry,
} from "./draftStore";

export {
  channelHasDraft,
  type DraftValue,
  deleteEntry,
  draftCacheKey,
  drafts,
  draftsForChannel,
  draftsReady,
  seedDraft,
} from "./draftStore";
export { createPendingFileState } from "./pendingFiles";

const pendingFlushCallbacks = new Set<() => Promise<void>>();

export function flushAllPendingDrafts(): Promise<void> {
  return Promise.all([...pendingFlushCallbacks].map((fn) => fn())).then(() => {});
}

export function createComposerDraftState(opts: {
  channelId: () => string | undefined;
  editing: () => boolean;
  key: () => string | undefined;
  loadIntoEditor: (text: string, blocks?: Block[]) => void;
  resetPreviews: () => void;
  setText: (text: string) => void;
  text: () => string;
  blocks?: () => Block[] | undefined;
  threadTs: () => string | undefined;
}) {
  const [activeDraftId, setActiveDraftId] = createSignal<string | undefined>(undefined);
  const [syncError, setSyncError] = createSignal(false);
  let clientMsgId: string | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue: Promise<void> = Promise.resolve();
  let defaultForKey: string | undefined;
  let loadedFor: string | undefined;
  let persistedFor: string | undefined;
  let sessionGeneration = 0;

  function runSave(
    channelId: string,
    threadTs: string | undefined,
    text: string,
    blocks: Block[] | undefined,
    startId: string | undefined,
    startCmid: string | undefined,
    generation: number,
  ): Promise<void> {
    const key = draftCacheKey(channelId, threadTs);
    locallyTouchedKeys.add(key);
    const next = saveQueue
      .catch(() => {})
      .then(async () => {
        if (!(await hydrateDrafts())) throw new Error("Draft hydration failed");
        if (!text.trim()) {
          if (startId) {
            await deleteDraft(startId);
            removeEntry(key, startId);
            if (generation === sessionGeneration && activeDraftId() === startId)
              setActiveDraftId(undefined);
          }
          return;
        }
        const cmid = startCmid ?? crypto.randomUUID();
        const knownTs = startId
          ? drafts[key]?.find((e) => e.id === startId)?.lastUpdatedTs
          : undefined;
        const result = await saveDraft(channelId, threadTs, text, blocks, startId, cmid, knownTs);
        upsertEntry(key, {
          blocks,
          clientMsgId: cmid,
          id: result.id,
          lastUpdatedTs: result.lastUpdatedTs,
          text,
        });
        const apply = generation === sessionGeneration && activeDraftId() === startId;
        if (apply) {
          clientMsgId = cmid;
          loadedFor = `${key}::${result.id}`;
          setActiveDraftId(result.id);
        }
      })
      .then(
        () => {
          setSyncError(false);
        },
        () => {
          setSyncError(true);
        },
      );
    saveQueue = next;
    return next;
  }

  function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    const channelId = opts.channelId();
    if (!channelId) return Promise.resolve();
    return runSave(
      channelId,
      opts.threadTs(),
      opts.text(),
      opts.blocks?.(),
      activeDraftId(),
      clientMsgId,
      sessionGeneration,
    );
  }

  createEffect(() => {
    if (opts.editing() || !opts.channelId()) return;
    void hydrateDrafts();
  });

  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    if (key === defaultForKey) return;
    defaultForKey = key;
    const list = (key && drafts[key]) || [];
    const top = list.length
      ? list.reduce((a, b) => (Number(b.lastUpdatedTs ?? 0) > Number(a.lastUpdatedTs ?? 0) ? b : a))
      : undefined;
    clientMsgId = top?.clientMsgId;
    setActiveDraftId(top?.id);
  });

  createEffect(() => {
    const key = opts.key();
    const id = activeDraftId();
    if (opts.editing() || !draftsReady() || !key || !id) return;
    if (drafts[key]?.some((e) => e.id === id)) return;
    sessionGeneration += 1;
    clientMsgId = undefined;
    setActiveDraftId(undefined);
  });

  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    const id = activeDraftId();
    const token = `${key}::${id ?? "new"}`;
    if (token === loadedFor) return;
    loadedFor = token;
    const entry = key && id ? drafts[key]?.find((e) => e.id === id) : undefined;
    opts.setText(entry?.text ?? "");
    opts.loadIntoEditor(entry?.text ?? "", entry?.blocks);
    opts.resetPreviews();
  });

  createEffect(() => {
    if (opts.editing() || !draftsReady()) return;
    const key = opts.key();
    const channelId = opts.channelId();
    if (!(key && channelId)) return;
    const id = activeDraftId();
    const token = `${key}::${id ?? "new"}`;
    const value = opts.text();
    const blocks = opts.blocks?.();

    const skip = token !== persistedFor;
    persistedFor = token;
    if (skip) return;

    if (value.trim() && id) {
      upsertEntry(key, { blocks, clientMsgId: clientMsgId ?? "", id, text: value });
    } else if (!value.trim() && id) {
      removeEntry(key, id);
    }

    const scheduledCmid = clientMsgId;
    const scheduledGeneration = sessionGeneration;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void runSave(
        channelId,
        opts.threadTs(),
        value,
        blocks,
        id,
        scheduledCmid,
        scheduledGeneration,
      );
    }, 1000);
  });

  pendingFlushCallbacks.add(flush);
  onCleanup(() => {
    pendingFlushCallbacks.delete(flush);
    void flush();
  });

  return {
    activeDraftId,
    async clearAfterSend(pendingFiles: { clear: (key: string) => void }) {
      sessionGeneration += 1;
      clientMsgId = undefined;
      const channelId = opts.channelId();
      const key = channelId ? draftCacheKey(channelId, opts.threadTs()) : undefined;
      if (key) pendingFiles.clear(key);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      const id = activeDraftId();
      if (!(key && id)) return;
      removeEntry(key, id);
      setActiveDraftId(undefined);
      saveQueue = saveQueue
        .catch(() => {})
        .then(() => deleteDraft(id))
        .catch(() => {});
      await saveQueue;
    },
    flushNow: flush,
    retrySync: flush,
    async remove(entry: DraftValue) {
      const key = opts.key();
      if (!key) return;
      try {
        await deleteEntry(key, entry.id);
      } catch {
        setSyncError(true);
      }
    },
    async saveAndStartNew() {
      await flush();
      sessionGeneration += 1;
      clientMsgId = undefined;
      setActiveDraftId(undefined);
    },
    stack(): DraftValue[] {
      const key = opts.key();
      const id = activeDraftId();
      if (!key) return [];
      return (drafts[key] ?? []).filter((e) => e.id !== id);
    },
    switchTo(entry: DraftValue) {
      ({ clientMsgId } = entry);
      setActiveDraftId(entry.id);
    },
    syncError,
  };
}
