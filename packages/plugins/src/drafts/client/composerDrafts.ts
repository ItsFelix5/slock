import type { Env, TimerHandle } from "@slock/core";
import { blockPreviewText, isSlackError } from "@slock/slack";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { saveDraft } from "./draftApi";
import { type DraftStore, draftCacheKey, isNewerDraft } from "./draftStore";

const SAVE_DELAY_MS = 1000;

export type ComposerDraftOptions = {
  channelId: () => ChannelId | undefined;
  threadTs: () => Ts | undefined;
  blocks: () => Block[];
  loadIntoEditor: (blocks: Block[]) => void;
  ready: () => boolean;
};

export function createComposerDraftState(store: DraftStore, env: Env, opts: ComposerDraftOptions) {
  const { drafts } = store;
  const [activeDraftId, setActiveDraftId] = createSignal<string | undefined>(undefined);
  const [syncError, setSyncError] = createSignal(false);
  let clientMsgId: string | undefined;
  let saveTimer: TimerHandle | undefined;
  let pendingSave: (() => void) | undefined;
  let saveQueue: Promise<void> = Promise.resolve();
  let defaultForKey: string | undefined;
  let loadedFor: string | undefined;
  let persistedFor: string | undefined;
  let sessionGeneration = 0;
  const unsaved = new Map<string, Block[]>();

  const key = () => {
    const channelId = opts.channelId();
    return channelId ? draftCacheKey(channelId, opts.threadTs()) : undefined;
  };

  function enqueue(task: () => Promise<void>): Promise<void> {
    const next = saveQueue.then(task, task);
    saveQueue = next;
    return next;
  }

  async function tracked(task: () => Promise<void>) {
    try {
      await task();
      setSyncError(false);
    } catch (error) {
      if (!isSlackError(error)) throw error;
      setSyncError(true);
    }
  }

  function runSave(
    channelId: ChannelId,
    threadTs: Ts | undefined,
    blocks: Block[],
    knownId: string | undefined,
    startCmid: string | undefined,
    generation: number,
  ): Promise<void> {
    const draftKey = draftCacheKey(channelId, threadTs);
    store.touch(draftKey);
    unsaved.set(draftKey, blocks);
    return enqueue(() =>
      tracked(async () => {
        const startId = knownId ?? drafts[draftKey]?.find((e) => e.clientMsgId === startCmid)?.id;
        if (startId && !(await store.hydrate())) {
          setSyncError(true);
          return;
        }
        if (!blockPreviewText(blocks).trim()) {
          if (startId) {
            await store.deleteOnServer(startId);
            store.remove(draftKey, startId);
            if (generation === sessionGeneration && activeDraftId() === startId) {
              setActiveDraftId(undefined);
            }
          }
          return;
        }
        const cmid = startCmid ?? crypto.randomUUID();
        const knownTs = startId
          ? drafts[draftKey]?.find((e) => e.id === startId)?.lastUpdatedTs
          : undefined;
        const result = await saveDraft(channelId, threadTs, blocks, startId, cmid, knownTs);
        store.upsert({
          blocks,
          channelId,
          clientMsgId: cmid,
          id: result.id,
          lastUpdatedTs: result.lastUpdatedTs,
          threadTs,
        });
        unsaved.delete(draftKey);
        if (generation === sessionGeneration && activeDraftId() === knownId && draftKey === key()) {
          clientMsgId = cmid;
          loadedFor = `${draftKey}::${result.id}`;
          setActiveDraftId(result.id);
        }
      }),
    );
  }

  function currentClientMsgId(): string {
    clientMsgId ??= crypto.randomUUID();
    return clientMsgId;
  }

  function cancelPendingSave() {
    env.clearTimeout(saveTimer);
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
    if (opts.channelId()) void store.hydrate();
  });

  createEffect(() => {
    if (!store.ready()) return;
    const draftKey = key();
    if (draftKey === defaultForKey) return;
    defaultForKey = draftKey;
    const top = ((draftKey && drafts[draftKey]) || []).reduce<DraftEntry | undefined>(
      (best, entry) => (best && !isNewerDraft(entry, best) ? best : entry),
      undefined,
    );
    clientMsgId = top?.clientMsgId;
    setActiveDraftId(top?.id);
  });

  createEffect(() => {
    const draftKey = key();
    const id = activeDraftId();
    if (!(store.ready() && draftKey && id)) return;
    if (drafts[draftKey]?.some((e) => e.id === id)) return;
    sessionGeneration += 1;
    clientMsgId = undefined;
    if (blockPreviewText(opts.blocks()).trim()) {
      loadedFor = `${draftKey}::new`;
      persistedFor = loadedFor;
    }
    setActiveDraftId(undefined);
  });

  createEffect(() => {
    if (!(opts.ready() && store.ready())) return;
    const draftKey = key();
    const id = activeDraftId();
    const token = `${draftKey}::${id ?? "new"}`;
    if (token === loadedFor) return;
    loadedFor = token;
    const entry = draftKey && id ? drafts[draftKey]?.find((e) => e.id === id) : undefined;
    opts.loadIntoEditor(entry?.blocks ?? (draftKey ? unsaved.get(draftKey) : undefined) ?? []);
  });

  createEffect(() => {
    if (!(opts.ready() && store.ready())) return;
    const draftKey = key();
    const channelId = opts.channelId();
    if (!(draftKey && channelId)) return;
    const id = activeDraftId();
    const token = `${draftKey}::${id ?? "new"}`;
    const blocks = opts.blocks();
    const empty = !blockPreviewText(blocks).trim();

    const skip = token !== persistedFor;
    persistedFor = token;
    if (skip) {
      flushPendingSave();
      return;
    }

    const threadTs = opts.threadTs();
    if (!empty && id) {
      store.upsert({ blocks, channelId, clientMsgId: clientMsgId ?? "", id, threadTs });
    } else if (empty && id) {
      store.remove(draftKey, id);
    }

    const scheduledCmid = currentClientMsgId();
    const scheduledGeneration = sessionGeneration;
    cancelPendingSave();
    pendingSave = () => {
      void runSave(channelId, threadTs, blocks, id, scheduledCmid, scheduledGeneration);
    };
    saveTimer = env.setTimeout(flushPendingSave, SAVE_DELAY_MS);
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
      const draftKey = draftCacheKey(channelId, opts.threadTs());
      pendingFiles.clear(draftKey);
      cancelPendingSave();
      const activeId = activeDraftId();
      if (activeId) store.remove(draftKey, activeId);
      loadedFor = `${draftKey}::new`;
      setActiveDraftId(undefined);
      await enqueue(() =>
        tracked(async () => {
          const ids = new Set(
            (drafts[draftKey] ?? [])
              .filter((e) => e.clientMsgId === sentClientMsgId)
              .map((e) => e.id),
          );
          if (activeId) ids.add(activeId);
          for (const id of ids) {
            await store.deleteOnServer(id);
            store.remove(draftKey, id);
          }
        }),
      );
    },
    flushNow: flush,
    retrySync: flush,
    remove(entry: DraftEntry) {
      const draftKey = key();
      if (!draftKey) return Promise.resolve();
      return tracked(() => store.deleteEntry(draftKey, entry.id));
    },
    async saveAndStartNew() {
      await flush();
      sessionGeneration += 1;
      clientMsgId = undefined;
      setActiveDraftId(undefined);
    },
    stack(): DraftEntry[] {
      const draftKey = key();
      const id = activeDraftId();
      if (!draftKey) return [];
      return (drafts[draftKey] ?? []).filter((e) => e.id !== id);
    },
    switchTo(entry: DraftEntry) {
      ({ clientMsgId } = entry);
      setActiveDraftId(entry.id);
    },
    syncError,
  };
}
