import type { Setup } from "@slock/core";
import { gatewayHandler } from "../../realtime/client/api";
import { applyRemoteDraft, hydrateDrafts, removeRemoteDraft, resetDrafts } from "./draftStore";

const setup: Setup = (ctx) => {
  ctx.onCleanup(resetDrafts);
  void hydrateDrafts();
  ctx.add(
    "realtime.handler",
    gatewayHandler(["draft_create", "draft_update"], (event) => applyRemoteDraft(event.draft)),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["draft_delete", "draft_send"], (event) => {
      if (event.draft_id) removeRemoteDraft(event.draft_id);
    }),
  );
};

export default setup;
