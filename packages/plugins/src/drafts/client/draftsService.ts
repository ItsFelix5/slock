import type { Env } from "@slock/core";
import { type ComposerDraftOptions, createComposerDraftState } from "./composerDrafts";
import type { DraftStore } from "./draftStore";

export function createDraftsService(store: DraftStore, env: Env) {
  return {
    channelHasDraft: store.channelHasDraft,
    createComposerState: (opts: ComposerDraftOptions) =>
      createComposerDraftState(store, env, opts),
    deleteEntry: store.deleteEntry,
    draftsForChannel: store.draftsForChannel,
    seedDraft: store.seed,
  };
}
