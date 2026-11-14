import { service } from "@slock/core/solid";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import { APP_HOME_QUERY, fetchAppHome } from "../fetch";

const appHomeKey = defineKey<[string]>(APP_HOME_QUERY);
const dms = service("dms");
const users = service("users");

export function useAppHome(channelId: () => string) {
  return createKeyedQuery(() => {
    const id = channelId();
    const botDm = users.userById(dms.dmById(id)?.userId ?? "")?.isBot;
    if (!botDm) return;
    return { queryFn: () => fetchAppHome(id), queryKey: appHomeKey(id) };
  });
}
