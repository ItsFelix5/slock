import type { Setup } from "@slock/core";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { createDraftStore } from "./draftStore";
import { createDraftsService } from "./draftsService";
import { mapDraft } from "./mapDraft";

const setup: Setup = (ctx) => {
  const store = createDraftStore();
  void store.hydrate();
  ctx.provide("drafts", createDraftsService(store, ctx.get("env")));
  ctx.add(
    "realtime.handler",
    gatewayHandler(["draft_create", "draft_update"], (event) =>
      store.applyRemote(mapDraft(event.draft)),
    ),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["draft_delete", "draft_send"], (event) => {
      if (event.draft_id) store.removeRemote(event.draft_id);
    }),
  );
};

export default setup;
