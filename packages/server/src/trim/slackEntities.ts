import type { RawBot, RawIcons, RawUser, RawUserProfile } from "@slock/types";

export function trimIcons(icons: RawIcons | undefined): RawIcons | undefined {
  if (!icons) return icons;
  return {
    image_32: icons.image_32,
    image_36: icons.image_36,
    image_48: icons.image_48,
    image_64: icons.image_64,
    image_72: icons.image_72,
  };
}

export function trimProfile(profile: RawUserProfile): RawUserProfile {
  return {
    api_app_id: profile.api_app_id,
    avatar_hash: profile.avatar_hash,
    bot_id: profile.bot_id,
    display_name: profile.display_name,
    email: profile.email,
    fields: profile.fields
      ? Object.fromEntries(
          Object.entries(profile.fields).map(([id, field]) => [
            id,
            field ? { alt: field.alt, value: field.value } : field,
          ]),
        )
      : profile.fields,
    image_192: profile.image_192,
    image_48: profile.image_48,
    image_72: profile.image_72,
    phone: profile.phone,
    pronouns: profile.pronouns,
    real_name: profile.real_name,
    start_date: profile.start_date,
    status_emoji: profile.status_emoji,
    status_text: profile.status_text,
    team: profile.team,
    title: profile.title,
  };
}

export function trimUser(user: RawUser): RawUser {
  return {
    color: user.color,
    deleted: user.deleted,
    id: user.id,
    is_admin: user.is_admin,
    is_bot: user.is_bot,
    is_owner: user.is_owner,
    is_primary_owner: user.is_primary_owner,
    name: user.name,
    presence: user.presence,
    profile: trimProfile(user.profile ?? {}),
    real_name: user.real_name,
    team_id: user.team_id,
    tz: user.tz,
    tz_label: user.tz_label,
    tz_offset: user.tz_offset,
  };
}

export function trimBot(bot: RawBot): RawBot {
  return {
    app_id: bot.app_id,
    icons: trimIcons(bot.icons),
    id: bot.id,
    name: bot.name,
    user_id: bot.user_id,
  };
}
