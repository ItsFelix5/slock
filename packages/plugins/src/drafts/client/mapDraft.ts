import { ifPresent, parseChannelId, parseTs } from "@slock/slack";
import type { DraftEntry, RawDraftEntry } from "@slock/types";

export function mapDraft(raw: RawDraftEntry): DraftEntry {
  return {
    blocks: raw.blocks,
    channelId: parseChannelId(raw.channelId),
    clientMsgId: raw.clientMsgId,
    id: raw.id,
    lastUpdatedTs: ifPresent(parseTs, raw.lastUpdatedTs),
    threadTs: ifPresent(parseTs, raw.threadTs),
  };
}
