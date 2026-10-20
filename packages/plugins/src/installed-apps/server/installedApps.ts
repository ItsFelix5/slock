import type { Credentials } from "../../slack/server/api/auth";
import { callSlack, type SlackReply } from "../../slack/server/api/slackClient";

type RawApp = {
  id: string;
  name: string;
  icons?: Record<string, string>;
  is_app_directory_approved?: boolean;
  is_certified?: boolean;
};

type Page = { apps: RawApp[]; response_metadata?: { next_cursor?: string } };

export type InstalledApp = { id: string; name: string; icon?: string; official: boolean };

function toInstalledApp(app: RawApp): InstalledApp {
  return {
    icon: app.icons?.image_48 ?? Object.values(app.icons ?? {})[0],
    id: app.id,
    name: app.name,
    official: !!(app.is_app_directory_approved || app.is_certified),
  };
}

export async function listInstalledApps(
  userId: string,
  creds: Credentials | null,
): Promise<SlackReply<{ apps: InstalledApp[] }>> {
  const apps = new Map<string, InstalledApp>();
  let cursor = "";
  do {
    const page = await callSlack<Page>(
      "admin.apps.installed.list",
      { legacy_integrations: "false", limit: "100", user_id: userId, ...(cursor && { cursor }) },
      creds,
    );
    if (!page.ok) return page;
    for (const app of page.apps) apps.set(app.id, toInstalledApp(app));
    cursor = page.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return { apps: [...apps.values()], ok: true };
}
