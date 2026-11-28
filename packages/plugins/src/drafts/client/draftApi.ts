import { ifPresent, parseTs, replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPut } from "@slock/slack/client";
import type { Block, ChannelId, DraftEntry, RawDraftEntry, Ts } from "@slock/types";
import { mapDraft } from "./mapDraft";

export async function fetchDrafts(signal: AbortSignal): Promise<DraftEntry[]> {
  const data = await apiGet<{ drafts?: RawDraftEntry[] }>("/api/drafts", signal);
  if (!data.ok) throw replyError(data, "drafts.list failed");
  return (data.drafts ?? []).map(mapDraft);
}

export async function saveDraft(
  channelId: ChannelId,
  threadTs: Ts | undefined,
  blocks: Block[],
  draftId: string | undefined,
  clientMsgId: string,
  lastUpdatedTs?: Ts,
): Promise<{ id: string; lastUpdatedTs?: Ts }> {
  const data = await apiPut<{ id: string; lastUpdatedTs?: string }>(
    "/api/drafts",
    { blocks, channelId, clientMsgId, draftId, lastUpdatedTs, threadTs },
    { keepalive: true },
  );
  if (!data.ok) throw replyError(data, "drafts.create failed");
  return {
    id: data.id,
    lastUpdatedTs: ifPresent(parseTs, data.lastUpdatedTs),
  };
}

export async function deleteDraft(draftId: string, lastUpdatedTs?: Ts): Promise<void> {
  const data = await apiDelete(`/api/drafts/${draftId}`, { lastUpdatedTs }, { keepalive: true });
  if (!data.ok) throw replyError(data, "drafts.delete failed");
}
