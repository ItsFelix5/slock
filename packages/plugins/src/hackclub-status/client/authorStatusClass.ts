import { apiGet } from "@slock/slack";
import type { MessageAuthorClass } from "../../messages/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";

const hackclubStatusKey = defineKey<[string]>("hackclubStatus");

const STALE_MS = 5 * 60_000;

async function fetchHackClubStatus(userId: string): Promise<string> {
  const data = await apiGet<{ status: string }>(`/api/hackclub-status/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "hack club status lookup failed");
  return data.status;
}

export const authorStatusClass: MessageAuthorClass = ({ user, userId, visible }) => {
  const status = createKeyedQuery(() => {
    const id = userId();
    if (!(visible() && id && user() && !user()?.isBot)) return;
    return {
      queryFn: () => fetchHackClubStatus(id).catch(() => null),
      queryKey: hackclubStatusKey(id),
      staleTime: STALE_MS,
    };
  });
  return () => (status.data ? `hackclub-status-${status.data}` : undefined);
};
