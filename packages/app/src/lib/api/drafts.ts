import type { DraftEntry } from "@slock/types";
import { apiDelete, apiGet, apiPut } from "@slock/types";

export async function fetchDrafts(): Promise<DraftEntry[]> {
  const data = await apiGet<{ drafts?: DraftEntry[] }>("/api/drafts");
  if (!data.ok) throw new Error(data.error ?? "drafts.list failed");
  return data.drafts ?? [];
}

export async function saveDraft(
  channelId: string,
  threadTs: string | undefined,
  text: string,
  blocks?: unknown,
  draftId?: string,
  clientMsgId?: string,
  lastUpdatedTs?: string,
): Promise<{ id: string; clientMsgId: string; lastUpdatedTs?: string }> {
  const data = await apiPut<{ id?: string; lastUpdatedTs?: string }>("/api/drafts", {
    blocks,
    channelId,
    clientMsgId: clientMsgId ?? crypto.randomUUID(),
    draftId,
    lastUpdatedTs,
    text,
    threadTs,
  });
  if (!data.ok) throw new Error(data.error ?? "drafts.create failed");
  if (!data.id) throw new Error("drafts.create returned no draft id");
  return {
    clientMsgId: clientMsgId ?? "",
    id: data.id,
    lastUpdatedTs: data.lastUpdatedTs,
  };
}

export async function deleteDraft(draftId: string, lastUpdatedTs?: string): Promise<void> {
  const data = await apiDelete(`/api/drafts/${draftId}`, { lastUpdatedTs });
  if (!data.ok) throw new Error(data.error ?? "drafts.delete failed");
}
