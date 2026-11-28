import type { Block, DraftEntry } from "@slock/types";
import {
  reduceSession,
  type SessionState,
  type SyncFacts,
} from "../../../../packages/plugins/src/drafts/client/draftSession";
import { ch } from "../../../support/slack";
import { blocks } from "./composerHarness";

const noBlocks: Block[] = [];

const facts = (over: Partial<SyncFacts> = {}): SyncFacts => ({
  activeDraftId: undefined,
  blocks: noBlocks,
  channelId: ch("C1"),
  draftKey: "C1",
  editorReady: true,
  empty: true,
  entries: [],
  mintedId: "minted",
  storeReady: true,
  threadTs: undefined,
  unsaved: undefined,
  ...over,
});

export const entry = (id: string, over: Partial<DraftEntry> = {}): DraftEntry => ({
  blocks: blocks(`text ${id}`),
  channelId: ch("C1"),
  clientMsgId: `cm-${id}`,
  id,
  ...over,
});

export const sync = (state: SessionState, over: Partial<SyncFacts> = {}) =>
  reduceSession(state, { facts: facts(over), kind: "sync" });

export const kinds = (effects: { kind: string }[]) => effects.map((effect) => effect.kind);
