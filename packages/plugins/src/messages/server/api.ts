import type { HistoryReply } from "../../slack/server/api/slackReplies";
import { trimMessage } from "../../slack/server/api/trim/slackMessages";

const HISTORY_PARAM_KEYS = ["cursor", "latest", "oldest", "inclusive", "limit"] as const;

export function historyParams(
  base: Record<string, string>,
  searchParams: URLSearchParams,
): Record<string, string> {
  const params = { ...base };
  for (const key of HISTORY_PARAM_KEYS) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }
  return params;
}

export function trimHistory(data: HistoryReply) {
  return {
    has_more: data.has_more,
    messages: data.messages?.map(trimMessage),
    ok: true,
    response_metadata: data.response_metadata
      ? { next_cursor: data.response_metadata.next_cursor }
      : undefined,
  };
}
