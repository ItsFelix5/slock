import type { Credentials } from "./auth";
import { teamIdFromRoute } from "./auth";
import { callSlack } from "./slackClient";
import type { AppProfileReply } from "./slackReplies";

export function fetchAppProfile(appId: string, creds: Credentials | null, botId?: string) {
  return callSlack<AppProfileReply>(
    "apps.profile.get",
    {
      app: appId,
      ...(botId && { bot: botId, bot_home_team: teamIdFromRoute(creds?.route ?? "") }),
    },
    creds,
  );
}
