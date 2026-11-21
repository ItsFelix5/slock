import { apiGet } from "@slock/slack";
import type { UserId } from "@slock/types";
import type { MessageAuthorClass } from "../../messages/client/api";
import { defineQuery } from "../../query/client/api";

const STALE_MS = 5 * 60_000;

async function fetchHackClubStatus(userId: UserId): Promise<string> {
  const data = await apiGet<{ status: string }>(`/api/users/${userId}/hackclub-status`);
  if (!data.ok) throw new Error(data.error ?? "hack club status lookup failed");
  return data.status;
}

const hackclubStatus = defineQuery<UserId, string | null>({
  load: (id) => fetchHackClubStatus(id).catch(() => null),
  maxAgeMs: STALE_MS,
  name: "hackclubStatus",
});

export const authorStatusClass: MessageAuthorClass = ({ user, userId, visible }) => {
  const status = hackclubStatus.state(() => {
    const id = userId();
    return visible() && id && user() && !user()?.isBot ? id : undefined;
  });
  return () => {
    const { data } = status();
    return data ? `hackclub-status-${data}` : undefined;
  };
};
