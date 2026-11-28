import { assertNever, createDebouncer, type Env } from "@slock/core";
import { service } from "@slock/core/solid";
import { isSlackError } from "@slock/slack";
import { blockPreviewText } from "@slock/slack/client";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { saveDraft } from "./draftApi";
import {
  initialSession,
  reduceSession,
  type SessionEffect,
  type SessionInput,
} from "./draftSession";
import { type DraftStore, draftCacheKey } from "./draftStore";

const SAVE_DELAY_MS = 1000;

const query = service("query");

const isEmpty = (blocks: Block[]) => !blockPreviewText(blocks).trim();

export type ComposerDraftOptions = {
  channelId: () => ChannelId | undefined;
  threadTs: () => Ts | undefined;
  blocks: () => Block[];
  loadIntoEditor: (blocks: Block[]) => void;
  ready: () => boolean;
};

export function createComposerDraftState(store: DraftStore, env: Env, opts: ComposerDraftOptions) {
  const { drafts, unsaved } = store;
  const [activeDraftId, setActiveDraftId] = createSignal<string | undefined>(undefined);
  const [syncError, setSyncError] = createSignal(false);
  let session = initialSession;
  const autosave = createDebouncer(env, runSave, SAVE_DELAY_MS);
  onCleanup(query.hub.onFlush(autosave.flush));

  const key = () => {
    const channelId = opts.channelId();
    return channelId ? draftCacheKey(channelId, opts.threadTs()) : undefined;
  };

  const earlierSave = untrack(() => {
    const draftKey = key();
    return draftKey ? store.settled(draftKey) : undefined;
  });
  const [caughtUp, setCaughtUp] = createSignal(!earlierSave);
  const catchUp = () => void setCaughtUp(true);
  void earlierSave?.then(catchUp, catchUp);

  function dispatch(input: SessionInput) {
    const step = reduceSession(session, input);
    session = step.state;
    for (const effect of step.effects) run(effect);
  }

  function run(effect: SessionEffect) {
    switch (effect.kind) {
      case "loadIntoEditor":
        return opts.loadIntoEditor(effect.blocks);
      case "setActiveDraftId":
        return setActiveDraftId(effect.id);
      case "flushPendingSave":
        return autosave.flush();
      case "upsertDraft":
        return store.upsert(effect.entry);
      case "removeDraft":
        return store.remove(effect.draftKey, effect.id);
      case "scheduleSave": {
        const { blocks, channelId, clientMsgId, generation, id, threadTs } = effect;
        return autosave.schedule(channelId, threadTs, blocks, id, clientMsgId, generation);
      }
      default:
        return assertNever(effect);
    }
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
    return store.enqueue(draftKey, () =>
      tracked(async () => {
        const startId = knownId ?? drafts[draftKey]?.find((e) => e.clientMsgId === startCmid)?.id;
        if (startId && !(await store.hydrate())) {
          setSyncError(true);
          return;
        }
        if (isEmpty(blocks)) {
          if (startId) {
            await store.deleteOnServer(startId);
            store.remove(draftKey, startId);
            dispatch({
              activeId: activeDraftId(),
              draftKey,
              generation,
              kind: "deleted",
              startId,
              typedEmpty: untrack(() => isEmpty(opts.blocks())),
            });
          }
          return;
        }
        if (generation !== session.generation) return;
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
        dispatch({
          activeId: activeDraftId(),
          clientMsgId: cmid,
          currentKey: key(),
          draftKey,
          generation,
          id: result.id,
          kind: "saved",
          knownId,
        });
      }),
    );
  }

  function flush(): Promise<void> {
    autosave.cancel();
    const channelId = opts.channelId();
    if (!channelId) return Promise.resolve();
    dispatch({ kind: "claimClientMsgId", mintedId: crypto.randomUUID() });
    return runSave(
      channelId,
      opts.threadTs(),
      opts.blocks(),
      activeDraftId(),
      session.clientMsgId,
      session.generation,
    );
  }

  createEffect(opts.channelId, (channelId) => {
    if (channelId) void store.hydrate();
  });

  createEffect(
    () => {
      const draftKey = key();
      const blocks = opts.blocks();
      return {
        activeDraftId: activeDraftId(),
        blocks,
        channelId: opts.channelId(),
        draftKey,
        editorReady: opts.ready(),
        empty: isEmpty(blocks),
        entries: draftKey ? (drafts[draftKey] ?? []).map((entry) => ({ ...entry })) : [],
        mintedId: crypto.randomUUID(),
        storeReady: store.ready() && caughtUp(),
        threadTs: opts.threadTs(),
        unsaved: draftKey ? untrack(() => unsaved.get(draftKey)) : undefined,
      };
    },
    (facts) => void dispatch({ facts, kind: "sync" }),
  );

  onCleanup(() => {
    if (caughtUp()) void flush();
  });

  return {
    activeDraftId,
    current(): { clientMsgId: string; id: string } | undefined {
      const id = activeDraftId();
      const { clientMsgId } = session;
      return id && clientMsgId ? { clientMsgId, id } : undefined;
    },
    discard(id: string) {
      const draftKey = key();
      if (!draftKey) return Promise.resolve();
      return store.enqueue(draftKey, () => tracked(() => store.deleteOnServer(id)));
    },
    async clearAfterSend(pendingFiles: { clear: (key: string) => void }, postedDraftId?: string) {
      const sentClientMsgId = session.clientMsgId;
      const channelId = opts.channelId();
      if (!channelId) return dispatch({ draftKey: undefined, kind: "sent" });
      const draftKey = draftCacheKey(channelId, opts.threadTs());
      pendingFiles.clear(draftKey);
      autosave.cancel();
      unsaved.delete(draftKey);
      const activeId = activeDraftId();
      if (activeId) store.remove(draftKey, activeId);
      dispatch({ draftKey, kind: "sent" });
      await store.enqueue(draftKey, () =>
        tracked(async () => {
          const ids = new Set(
            (drafts[draftKey] ?? [])
              .filter((e) => e.clientMsgId === sentClientMsgId)
              .map((e) => e.id),
          );
          if (activeId) ids.add(activeId);
          if (postedDraftId) ids.delete(postedDraftId);
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
      return store.enqueue(draftKey, () => tracked(() => store.deleteNow(draftKey, entry.id)));
    },
    async saveAndStartNew() {
      await flush();
      dispatch({ kind: "startNew" });
    },
    stack(): DraftEntry[] {
      const draftKey = key();
      const id = activeDraftId();
      if (!draftKey) return [];
      return (drafts[draftKey] ?? []).filter((e) => e.id !== id);
    },
    switchTo(entry: DraftEntry) {
      dispatch({ clientMsgId: entry.clientMsgId, id: entry.id, kind: "switch" });
    },
    syncError,
  };
}
