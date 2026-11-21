import { createLocalPref } from "@slock/plugins/slack/client/api/localPref";
import type { Message } from "@slock/types";

export type LogFilters = ReturnType<typeof createLogFilters>;

export function createLogFilters(currentUserId: () => string | undefined) {
  const [ignoreSelf, setIgnoreSelf] = createLocalPref("messageLogger.ignoreSelf", false);
  const [ignoreBots, setIgnoreBots] = createLocalPref("messageLogger.ignoreBots", false);
  const [ignoredUsers, setIgnoredUsers] = createLocalPref("messageLogger.ignoredUsers", "");

  const ignoredUserIds = () =>
    ignoredUsers()
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  const ignores = (msg: Message) =>
    (ignoreSelf() && !!msg.userId && msg.userId === currentUserId()) ||
    (ignoreBots() && !!msg.botId) ||
    (!!msg.userId && ignoredUserIds().includes(msg.userId));

  return {
    ignoreBots,
    ignoreSelf,
    ignoredUsers,
    ignores,
    setIgnoreBots,
    setIgnoreSelf,
    setIgnoredUsers,
  };
}
