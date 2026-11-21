import { apiDelete, apiGet, apiPut, ifPresent, parseTs } from "@slock/slack";
import type { Block, ChannelId, DraftEntry, Ts } from "@slock/types";

export async function fetchDrafts(): Promise<DraftEntry[]> {
  const data = await apiGet<{ drafts?: DraftEntry[] }>("/api/drafts");
  if (!data.ok) throw new Error(data.error ?? "drafts.list failed");
  return data.drafts ?? [];
}

export async function saveDraft(
  channelId: ChannelId,
  threadTs: Ts | undefined,
  blocks: Block[],
  draftId?: string,
  clientMsgId?: string,
  lastUpdatedTs?: Ts,
): Promise<{ id: string; clientMsgId: string; lastUpdatedTs?: Ts }> {
  const data = await apiPut<{ id?: string; lastUpdatedTs?: string }>("/api/drafts", {
    blocks,
    channelId,
    clientMsgId: clientMsgId ?? crypto.randomUUID(),
    draftId,
    lastUpdatedTs,
    threadTs,
  });
  if (!data.ok) throw new Error(data.error ?? "drafts.create failed");
  if (!data.id) throw new Error("drafts.create returned no draft id");
  return {
    clientMsgId: clientMsgId ?? "",
    id: data.id,
    lastUpdatedTs: ifPresent(parseTs, data.lastUpdatedTs),
  };
}

export async function deleteDraft(draftId: string, lastUpdatedTs?: Ts): Promise<void> {
  const data = await apiDelete(`/api/drafts/${draftId}`, { lastUpdatedTs });
  if (!data.ok) throw new Error(data.error ?? "drafts.delete failed");
}
