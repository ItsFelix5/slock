import { apiDelete, apiGet, apiPut } from "../server";

export type DraftEntry = { channelId: string; threadTs?: string; text: string };

// Tracks the real Slack draft id + client_msg_id behind each channel/thread's
// live composer draft, so repeated saves update the same draft.create row
// instead of creating a new one on every debounce tick.
const draftState = new Map<string, { draftId: string; clientMsgId: string }>();
function draftKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:${threadTs}` : channelId;
}

export async function fetchDrafts(): Promise<DraftEntry[]> {
  const data = await apiGet("/api/drafts");
  if (data.ok === false) throw new Error(data.error ?? "drafts.list failed");
  const drafts: any[] = data.drafts ?? [];
  return drafts.map((d) => {
    draftState.set(draftKey(d.channelId, d.threadTs), {
      clientMsgId: d.clientMsgId,
      draftId: d.id,
    });
    return { channelId: d.channelId, text: d.text, threadTs: d.threadTs };
  });
}

export async function saveDraft(channelId: string, threadTs: string | undefined, text: string) {
  const key = draftKey(channelId, threadTs);
  const existing = draftState.get(key);

  if (!text.trim()) {
    if (existing) {
      const data = await apiDelete(`/api/drafts/${existing.draftId}`);
      if (data.ok === false) throw new Error(data.error ?? "drafts.delete failed");
      draftState.delete(key);
    }
    return;
  }

  const clientMsgId = existing?.clientMsgId ?? crypto.randomUUID();
  const data = await apiPut("/api/drafts", {
    channelId,
    clientMsgId,
    draftId: existing?.draftId,
    text,
    threadTs,
  });
  if (data.ok === false) throw new Error(data.error ?? "drafts.create failed");
  if (!data.id) throw new Error("drafts.create returned no draft id");
  draftState.set(key, { clientMsgId, draftId: data.id });
}
