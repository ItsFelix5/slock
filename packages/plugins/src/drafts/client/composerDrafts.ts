import { blockPreviewText } from "@slock/slack";
import type { Block } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { saveDraft } from "../../slack/client/api/drafts";
import {
  type DraftValue,
  deleteDraftOnServer,
  deleteEntry,
  draftCacheKey,
  drafts,
  draftsReady,
  hydrateDrafts,
  locallyTouchedKeys,
  removeEntry,
  upsertEntry,
} from "./draftStore";

const SAVE_DELAY_MS = 1000;

export function createComposerDraftState(opts: {
  channelId: () => string | undefined;
  editing: () => boolean;
  key: () => string | undefined;
  blocks: () => Block[];
  loadIntoEditor: (blocks: Block[]) => void;
  ready: () => boolean;
  resetPreviews: () => void;
  threadTs: () => string | undefined;
}) {
  const [activeDraftId, setActiveDraftId] = createSignal<string | undefined>(undefined);
  const [syncError, setSyncError] = createSignal(false);
  let clientMsgId: string | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingSave: (() => void) | undefined;
  let saveQueue: Promise<void> = Promise.resolve();
  let defaultForKey: string | undefined;
  let loadedFor: string | undefined;
  let persistedFor: string | undefined;
  let sessionGeneration = 0;
  const unsaved = new Map<string, Block[]>();

  function runSave(
    channelId: string,
    threadTs: string | undefined,
    blocks: Block[],
    knownId: string | undefined,
    startCmid: string | undefined,
    generation: number,
  ): Promise<void> {
    const key = draftCacheKey(channelId, threadTs);
    locallyTouchedKeys.add(key);
    unsaved.set(key, blocks);
    const next = saveQueue
      .catch(() => {})
      .then(async () => {
        const startId = knownId ?? drafts[key]?.find((e) => e.clientMsgId === startCmid)?.id;
        if (startId && !(await hydrateDrafts())) throw new Error("Draft hydration failed");
        if (!blockPreviewText(blocks).trim()) {
          if (startId) {
            await deleteDraftOnServer(startId);
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
        const result = await saveDraft(channelId, threadTs, blocks, startId, cmid, knownTs);
        upsertEntry(key, {
          blocks,
          clientMsgId: cmid,
          id: result.id,
          lastUpdatedTs: result.lastUpdatedTs,
        });
        unsaved.delete(key);
        const apply =
          generation === sessionGeneration && activeDraftId() === knownId && key === opts.key();
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

  function currentClientMsgId(): string {
    clientMsgId ??= crypto.randomUUID();
    return clientMsgId;
  }

  function cancelPendingSave() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    pendingSave = undefined;
  }

  function flushPendingSave() {
    const save = pendingSave;
    cancelPendingSave();
    save?.();
  }

  function flush(): Promise<void> {
    cancelPendingSave();
    const channelId = opts.channelId();
    if (!channelId) return Promise.resolve();
    return runSave(
      channelId,
      opts.threadTs(),
      opts.blocks(),
      activeDraftId(),
      currentClientMsgId(),
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
    if (blockPreviewText(opts.blocks()).trim()) {
      loadedFor = `${key}::new`;
      persistedFor = loadedFor;
    }
    setActiveDraftId(undefined);
  });

  createEffect(() => {
    if (opts.editing() || !opts.ready() || !draftsReady()) return;
    const key = opts.key();
    const id = activeDraftId();
    const token = `${key}::${id ?? "new"}`;
    if (token === loadedFor) return;
    loadedFor = token;
    const entry = key && id ? drafts[key]?.find((e) => e.id === id) : undefined;
    opts.loadIntoEditor(entry?.blocks ?? (key ? unsaved.get(key) : undefined) ?? []);
    opts.resetPreviews();
  });

  createEffect(() => {
    if (opts.editing() || !opts.ready() || !draftsReady()) return;
    const key = opts.key();
    const channelId = opts.channelId();
    if (!(key && channelId)) return;
    const id = activeDraftId();
    const token = `${key}::${id ?? "new"}`;
    const blocks = opts.blocks();
    const empty = !blockPreviewText(blocks).trim();

    const skip = token !== persistedFor;
    persistedFor = token;
    if (skip) {
      flushPendingSave();
      return;
    }

    if (!empty && id) {
      upsertEntry(key, { blocks, clientMsgId: clientMsgId ?? "", id });
    } else if (empty && id) {
      removeEntry(key, id);
    }

    const scheduledCmid = currentClientMsgId();
    const scheduledGeneration = sessionGeneration;
    const threadTs = opts.threadTs();
    cancelPendingSave();
    pendingSave = () => {
      void runSave(channelId, threadTs, blocks, id, scheduledCmid, scheduledGeneration);
    };
    saveTimer = setTimeout(flushPendingSave, SAVE_DELAY_MS);
  });

  onCleanup(() => {
    void flush();
  });

  return {
    activeDraftId,
    async clearAfterSend(pendingFiles: { clear: (key: string) => void }) {
      sessionGeneration += 1;
      const sentClientMsgId = clientMsgId;
      clientMsgId = undefined;
      const channelId = opts.channelId();
      if (!channelId) return;
      const key = draftCacheKey(channelId, opts.threadTs());
      pendingFiles.clear(key);
      cancelPendingSave();
      const activeId = activeDraftId();
      if (activeId) removeEntry(key, activeId);
      loadedFor = `${key}::new`;
      setActiveDraftId(undefined);
      saveQueue = saveQueue
        .catch(() => {})
        .then(async () => {
          const ids = new Set(
            (drafts[key] ?? []).filter((e) => e.clientMsgId === sentClientMsgId).map((e) => e.id),
          );
          if (activeId) ids.add(activeId);
          for (const id of ids) {
            await deleteDraftOnServer(id);
            removeEntry(key, id);
          }
        })
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
