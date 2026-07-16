import { callSlack } from "../relay";

export type DraftEntry = { channelId: string; threadTs?: string; text: string };

// Tracks the real Slack draft id + client_msg_id behind each channel/thread's
// live composer draft, so repeated saves update the same draft.create row
// instead of creating a new one on every debounce tick.
const draftState = new Map<string, { draftId: string; clientMsgId: string }>();
function draftKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:${threadTs}` : channelId;
}

export async function fetchDrafts(): Promise<DraftEntry[]> {
  const data = await callSlack("drafts.list", { is_active: "true", limit: "100" });
  if (data.ok === false) return [];
  const drafts: any[] = data.drafts ?? [];
  return drafts.map((d) => {
    const dest = d.destinations?.[0] ?? {};
    draftState.set(draftKey(dest.channel_id, dest.thread_ts), {
      clientMsgId: d.client_msg_id,
      draftId: d.id,
    });
    return {
      channelId: dest.channel_id,
      text: d.blocks?.[0]?.text?.text ?? "",
      threadTs: dest.thread_ts,
    };
  });
}

export async function saveDraft(channelId: string, threadTs: string | undefined, text: string) {
  const key = draftKey(channelId, threadTs);
  const existing = draftState.get(key);

  if (!text.trim()) {
    if (existing) {
      await callSlack("drafts.delete", {
        client_last_updated_ts: String(Date.now() / 1000),
        draft_id: existing.draftId,
      });
      draftState.delete(key);
    }
    return;
  }

  const clientMsgId = existing?.clientMsgId ?? crypto.randomUUID();
  const destination: Record<string, string> = { channel_id: channelId };
  if (threadTs) destination.thread_ts = threadTs;
  const params: Record<string, string> = {
    blocks: JSON.stringify([{ text: { text, type: "mrkdwn" }, type: "section" }]),
    client_msg_id: clientMsgId,
    destinations: JSON.stringify([destination]),
    file_ids: "[]",
    is_from_composer: "true",
  };
  if (existing) params.draft_id = existing.draftId;
  const data = await callSlack("drafts.create", params);
  const draftId = data.draft?.id ?? data.id;
  if (data.ok !== false && draftId) draftState.set(key, { clientMsgId, draftId });
}
