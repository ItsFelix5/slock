import { apiGet } from "@slock/slack";
import type { MessageAuthorClass } from "../../messages/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";

const userStatusKey = defineKey<[string]>("userStatus");

const STALE_MS = 5 * 60_000;

async function fetchUserStatus(userId: string): Promise<string> {
  const data = await apiGet<{ status: string }>(`/api/user-status/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "user status lookup failed");
  return data.status;
}

export const authorStatusClass: MessageAuthorClass = ({ user, userId, visible }) => {
  const status = createKeyedQuery(() => {
    const id = userId();
    if (!(visible() && id && user() && !user()?.isBot)) return;
    return {
      queryFn: () => fetchUserStatus(id).catch(() => null),
      queryKey: userStatusKey(id),
      staleTime: STALE_MS,
    };
  });
  return () => (status.data ? `user-status-${status.data}` : undefined);
};
