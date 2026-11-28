import type { Setup } from "@slock/core";
import { slackPart } from "@slock/plugins/bootstrap/server/api";
import type { PrefsReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimFrecency } from "./frecency";

const setup: Setup = (ctx) => {
  ctx.add(
    "bootstrap.part",
    slackPart<PrefsReply>("notification_prefs", "users.prefs.get", ({ prefs = {} }) => ({
      channel_sections: prefs.channel_sections,
      emoji_use: prefs.emoji_use,
      frecency: trimFrecency(prefs),
      muted_channels: prefs.muted_channels,
      notification_prefs: prefs.all_notifications_prefs,
    })),
  );
};

export default setup;
