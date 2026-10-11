import type { Setup } from "@slock/core";
import { slackPart } from "../../bootstrap/server/api";
import type { PrefsReply } from "../../slack/server/api/slackReplies";

const setup: Setup = (ctx) => {
  ctx.add(
    "bootstrap.part",
    slackPart<PrefsReply>("notification_prefs", "users.prefs.get", ({ prefs = {} }) => ({
      channel_sections: prefs.channel_sections,
      emoji_use: prefs.emoji_use,
      frecency: prefs.frecency,
      frecency_ent_jumper: prefs.frecency_ent_jumper,
      frecency_jumper: prefs.frecency_jumper,
      muted_channels: prefs.muted_channels,
      notification_prefs: prefs.all_notifications_prefs,
    })),
  );
};

export default setup;
