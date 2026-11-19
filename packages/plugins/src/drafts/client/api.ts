import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import type { createDraftsService } from "./draftsService";

declare module "@slock/core/types" {
  interface Services {
    drafts: ReturnType<typeof createDraftsService>;
  }
}

export { draftCacheKey } from "./draftStore";

const drafts = service("drafts");

export const channelHasDraft = (channelId: ChannelId) => drafts.channelHasDraft(channelId);
export const draftsForChannel = (channelId: ChannelId) => drafts.draftsForChannel(channelId);
export const deleteEntry = (key: string, id: string) => drafts.deleteEntry(key, id);
