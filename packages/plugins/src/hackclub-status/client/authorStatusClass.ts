import type { MessageAuthorClass } from "@slock/plugins/messages/client/api";
import { defineQuery } from "@slock/plugins/query/client/api";
import { replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { UserId } from "@slock/types";

const STALE_MS = 5 * 60_000;

async function fetchHackClubStatus(userId: UserId, signal: AbortSignal): Promise<string> {
  const data = await apiGet<{ status: string }>(`/api/users/${userId}/hackclub-status`, signal);
  if (!data.ok) throw replyError(data, "hack club status lookup failed");
  return data.status;
}

const hackclubStatus = defineQuery<UserId, string>({
  load: (userId, { signal }) => fetchHackClubStatus(userId, signal),
  maxAgeMs: STALE_MS,
  name: "hackclubStatus",
  retry: { retries: 0 },
});

export const authorStatusClass: MessageAuthorClass = ({ user, userId, visible }) => {
  const status = hackclubStatus.state(
    () => {
      const id = userId();
      return visible() && id && user() && !user()?.isBot ? id : undefined;
    },
    { retryFailed: false },
  );
  return () => {
    const { data } = status();
    return data ? `hackclub-status-${data}` : undefined;
  };
};
