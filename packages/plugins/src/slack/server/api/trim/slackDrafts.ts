import { ifPresent, parseChannelId, parseTs } from "@slock/slack";
import type { DraftEntry } from "@slock/types";
import type { RawDraft } from "../slackReplies";

export function trimDraft(draft: RawDraft): DraftEntry | undefined {
  const [destination] = draft.destinations;
  if (!destination || isScheduled(draft)) return;
  return {
    blocks: draft.blocks ?? [],
    channelId: parseChannelId(destination.channel_id),
    clientMsgId: draft.client_msg_id,
    id: draft.id,
    lastUpdatedTs: ifPresent(parseTs, draft.last_updated_ts),
    threadTs: ifPresent(parseTs, destination.thread_ts),
  };
}

// Scheduled messages are drafts on Slack's side. Listing one lets clearing the composer cancel it.
function isScheduled(draft: RawDraft): boolean {
  return Number(draft.date_scheduled ?? 0) > 0;
}

export function trimDrafts(drafts: readonly RawDraft[]): DraftEntry[] {
  return drafts.flatMap((draft) => trimDraft(draft) ?? []);
}
