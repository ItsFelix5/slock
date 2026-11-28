import { parseTs, replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPost, mapMessage } from "@slock/slack/client";
import type { ChannelId, PinnedMessage, RawMessage, Ts } from "@slock/types";

export async function fetchPins(
  channelId: ChannelId,
  signal: AbortSignal,
): Promise<PinnedMessage[]> {
  const data = await apiGet<PinsReply>(`/api/channels/${channelId}/pins`, signal);
  if (!data.ok) throw replyError(data, "pins.list failed");
  return (data.items ?? []).flatMap((it) =>
    it.ts ? [{ message: it.message ? mapMessage(it.message) : null, ts: parseTs(it.ts) }] : [],
  );
}

export async function togglePin(channelId: ChannelId, ts: Ts, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/pin`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw replyError(data, "pins.add/remove failed");
  return data;
}

type PinsReply = { items?: { message?: RawMessage; ts?: string }[] };
