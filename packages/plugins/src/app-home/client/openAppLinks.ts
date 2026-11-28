import { service } from "@slock/core/solid";
import { onLinkClick } from "@slock/ui/linkClick";
import { onSettled } from "solid-js";
import { type AppLink, parseAppLink } from "./appLinks";

import { fetchAppUserId } from "./fetch";

const dms = service("dms");
const appHome = service("app-home");
const feedback = service("feedback");

async function openApp({ appId, tab }: AppLink) {
  const botId = await fetchAppUserId(appId).catch(() => undefined);
  if (!botId) {
    feedback.flash("navigation", "Couldn't open that app.", "error");
    return;
  }
  if (!(await dms.openDmWithUser(botId))) return;
  const channelId = dms.dmIdForUser(botId);
  if (tab === "home" && channelId) appHome.openHome(channelId);
}

export function installAppLinks(): void {
  onSettled(() =>
    onLinkClick((anchor) => {
      const link = parseAppLink(anchor.href);
      if (!link) return false;
      void openApp(link);
      return true;
    }),
  );
}
