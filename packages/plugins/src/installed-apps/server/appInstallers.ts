import { decodeTextEntities } from "@slock/slack";
import type { Credentials } from "../../slack/server/api/auth";

type Authorizations = { authorizations: { encodedUserLink: string }[] };
type BotUser = { memberships: string[]; otherGroups: number };

export type AppInstallers = { userIds: string[]; channelIds: string[]; hiddenChannels: number };

async function readAutomountProps(page: Response): Promise<Map<string, string>> {
  const props = new Map<string, string>();
  await new HTMLRewriter()
    .on("[data-automount-component]", {
      element(element) {
        const name = element.getAttribute("data-automount-component");
        const json = element.getAttribute("data-automount-props");
        if (name && json) props.set(name, decodeTextEntities(json));
      },
    })
    .transform(page)
    .text();
  return props;
}

export async function fetchAppInstallers(
  appId: string,
  creds: Credentials,
): Promise<AppInstallers | null> {
  const [team = ""] = creds.route.split(":");
  const page = await fetch(`https://slack.com/marketplace/${appId}?team=${team}`, {
    headers: { cookie: `d=${creds.slackSession}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!page.ok) return null;
  const props = await readAutomountProps(page);
  const authorizations = props.get("AppDirectoryAuthorizations");
  const botUser = props.get("AppDirectoryBotUser");
  if (!(authorizations || botUser)) return null;
  const installers: Authorizations | undefined = authorizations && JSON.parse(authorizations);
  const bot: BotUser | undefined = botUser && JSON.parse(botUser);
  return {
    channelIds: bot?.memberships ?? [],
    hiddenChannels: bot?.otherGroups ?? 0,
    userIds: installers?.authorizations.map((auth) => auth.encodedUserLink) ?? [],
  };
}
