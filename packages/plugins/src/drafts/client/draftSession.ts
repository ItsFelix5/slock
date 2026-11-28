import { assertNever } from "@slock/core";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";
import { isNewerDraft } from "./draftStore";

type PersistFacts = {
  blocks: Block[];
  channelId: ChannelId | undefined;
  draftKey: string | undefined;
  empty: boolean;
  id: string | undefined;
  ready: boolean;
  threadTs: Ts | undefined;
};

type LoadFacts = { draftKey: string | undefined; id: string | undefined; ready: boolean };

export type SessionState = {
  clientMsgId: string | undefined;
  defaultForKey: string | undefined;
  generation: number;
  loadedFor: string | undefined;
  persistedFor: string | undefined;
  lastLoad: LoadFacts | undefined;
  lastPersist: PersistFacts | undefined;
};

export type SyncFacts = {
  activeDraftId: string | undefined;
  blocks: Block[];
  channelId: ChannelId | undefined;
  draftKey: string | undefined;
  editorReady: boolean;
  empty: boolean;
  entries: DraftEntry[];
  mintedId: string;
  storeReady: boolean;
  threadTs: Ts | undefined;
  unsaved: Block[] | undefined;
};

export type SessionInput =
  | { kind: "sync"; facts: SyncFacts }
  | { kind: "claimClientMsgId"; mintedId: string }
  | {
      kind: "saved";
      activeId: string | undefined;
      clientMsgId: string;
      currentKey: string | undefined;
      draftKey: string;
      generation: number;
      id: string;
      knownId: string | undefined;
    }
  | {
      kind: "deleted";
      activeId: string | undefined;
      draftKey: string;
      generation: number;
      startId: string;
      typedEmpty: boolean;
    }
  | { kind: "sent"; draftKey: string | undefined }
  | { kind: "startNew" }
  | { kind: "switch"; clientMsgId: string; id: string };

export type SessionEffect =
  | { kind: "loadIntoEditor"; blocks: Block[] }
  | { kind: "setActiveDraftId"; id: string | undefined }
  | { kind: "flushPendingSave" }
  | { kind: "upsertDraft"; entry: DraftEntry }
  | { kind: "removeDraft"; draftKey: string; id: string }
  | {
      kind: "scheduleSave";
      blocks: Block[];
      channelId: ChannelId;
      clientMsgId: string;
      generation: number;
      id: string | undefined;
      threadTs: Ts | undefined;
    };

type SessionStep = { state: SessionState; effects: SessionEffect[] };

export const initialSession: SessionState = {
  clientMsgId: undefined,
  defaultForKey: undefined,
  generation: 0,
  lastLoad: undefined,
  lastPersist: undefined,
  loadedFor: undefined,
  persistedFor: undefined,
};

const tokenOf = (draftKey: string | undefined, id: string | undefined) =>
  `${draftKey}::${id ?? "new"}`;

const setActive = (id: string | undefined): SessionEffect => ({ id, kind: "setActiveDraftId" });

function keepTypedText(
  state: SessionState,
  draftKey: string | undefined,
  typedEmpty: boolean,
): SessionState {
  if (typedEmpty) return state;
  const token = tokenOf(draftKey, undefined);
  return { ...state, loadedFor: token, persistedFor: token };
}

function newest(entries: DraftEntry[]): DraftEntry | undefined {
  return entries.reduce<DraftEntry | undefined>(
    (best, entry) => (best && !isNewerDraft(entry, best) ? best : entry),
    undefined,
  );
}

function samePersistFacts(a: PersistFacts, b: PersistFacts): boolean {
  return (
    a.blocks === b.blocks &&
    a.channelId === b.channelId &&
    a.draftKey === b.draftKey &&
    a.empty === b.empty &&
    a.id === b.id &&
    a.ready === b.ready &&
    a.threadTs === b.threadTs
  );
}

function sync(initial: SessionState, facts: SyncFacts): SessionStep {
  const { activeDraftId: id, draftKey, entries, storeReady } = facts;
  const effects: SessionEffect[] = [];
  let state = initial;

  if (storeReady && draftKey !== state.defaultForKey) {
    const top = newest(entries);
    state = { ...state, clientMsgId: top?.clientMsgId, defaultForKey: draftKey };
    effects.push(setActive(top?.id));
  }

  if (storeReady && draftKey && id && !entries.some((entry) => entry.id === id)) {
    state = keepTypedText(
      { ...state, clientMsgId: undefined, generation: state.generation + 1 },
      draftKey,
      facts.empty,
    );
    effects.push(setActive(undefined));
  }

  const ready = facts.editorReady && storeReady;
  const token = tokenOf(draftKey, id);

  const load: LoadFacts = { draftKey, id, ready };
  const { lastLoad } = state;
  const loadChanged =
    !lastLoad || lastLoad.draftKey !== draftKey || lastLoad.id !== id || lastLoad.ready !== ready;
  state = { ...state, lastLoad: load };

  if (loadChanged && ready && token !== state.loadedFor) {
    const entry = draftKey && id ? entries.find((e) => e.id === id) : undefined;
    state = { ...state, loadedFor: token };
    effects.push({ blocks: entry?.blocks ?? facts.unsaved ?? [], kind: "loadIntoEditor" });
  }

  const persist: PersistFacts = {
    blocks: facts.blocks,
    channelId: facts.channelId,
    draftKey,
    empty: facts.empty,
    id,
    ready,
    threadTs: facts.threadTs,
  };
  const repeated = !!state.lastPersist && samePersistFacts(state.lastPersist, persist);
  state = { ...state, lastPersist: persist };

  const { channelId } = facts;
  if (repeated || !(ready && draftKey && channelId)) return { effects, state };

  const skip = token !== state.persistedFor;
  state = { ...state, persistedFor: token };
  if (skip) {
    effects.push({ kind: "flushPendingSave" });
    return { effects, state };
  }

  if (id && !facts.empty) {
    effects.push({
      entry: {
        blocks: facts.blocks,
        channelId,
        clientMsgId: state.clientMsgId ?? "",
        id,
        threadTs: facts.threadTs,
      },
      kind: "upsertDraft",
    });
  } else if (id) {
    effects.push({ draftKey, id, kind: "removeDraft" });
  }

  const clientMsgId = state.clientMsgId ?? facts.mintedId;
  state = { ...state, clientMsgId };
  effects.push({
    blocks: facts.blocks,
    channelId,
    clientMsgId,
    generation: state.generation,
    id,
    kind: "scheduleSave",
    threadTs: facts.threadTs,
  });
  return { effects, state };
}

export function reduceSession(state: SessionState, input: SessionInput): SessionStep {
  switch (input.kind) {
    case "sync":
      return sync(state, input.facts);
    case "claimClientMsgId":
      return { effects: [], state: { ...state, clientMsgId: state.clientMsgId ?? input.mintedId } };
    case "saved": {
      const current =
        input.generation === state.generation &&
        input.activeId === input.knownId &&
        input.draftKey === input.currentKey;
      if (!current) return { effects: [], state };
      return {
        effects: [setActive(input.id)],
        state: {
          ...state,
          clientMsgId: input.clientMsgId,
          loadedFor: tokenOf(input.draftKey, input.id),
        },
      };
    }
    case "deleted": {
      const current = input.generation === state.generation && input.activeId === input.startId;
      if (!current) return { effects: [], state };
      return {
        effects: [setActive(undefined)],
        state: keepTypedText(state, input.draftKey, input.typedEmpty),
      };
    }
    case "sent": {
      const bumped = { ...state, clientMsgId: undefined, generation: state.generation + 1 };
      if (!input.draftKey) return { effects: [], state: bumped };
      const token = tokenOf(input.draftKey, undefined);
      return {
        effects: [setActive(undefined)],
        state: { ...bumped, loadedFor: token, persistedFor: token },
      };
    }
    case "startNew":
      return {
        effects: [setActive(undefined)],
        state: { ...state, clientMsgId: undefined, generation: state.generation + 1 },
      };
    case "switch":
      return {
        effects: [setActive(input.id)],
        state: { ...state, clientMsgId: input.clientMsgId },
      };
    default:
      return assertNever(input);
  }
}
