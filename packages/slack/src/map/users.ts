import type { RawUser, RawUserProfile, User, UserCustomField } from "@slock/types";
import { parseUserId } from "../ids";

export const SLACK_USER_ID = parseUserId("USLACK");
const SLACK_AVATAR_URL = "/public/slack-logo.svg";
const SLACKBOT_AVATAR_URL = "https://a.slack-edge.com/80588/img/plugins/slackbot/service_512.png";

function hashedAvatarUrl(raw: RawUser): string | undefined {
  const hash = raw.profile?.avatar_hash;
  const team = raw.profile?.team ?? raw.team_id;
  return hash && team ? `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192` : undefined;
}

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : "#616061";
}

function tzLabelFromOffset(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return;
  const sign = seconds >= 0 ? "+" : "-";
  const totalMinutes = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

export function mapCustomFields(
  profile: RawUserProfile | undefined,
): UserCustomField[] | undefined {
  const rawFields = profile?.fields ?? {};
  const customFields = Object.keys(rawFields)
    .map((id) => ({
      alt: rawFields[id]?.alt || undefined,
      id,
      value: rawFields[id]?.value ?? "",
    }))
    .filter((f) => f.value);
  return customFields.length ? customFields : undefined;
}

export function mapStartDate(profile: RawUserProfile | undefined): string | undefined {
  return profile?.start_date || undefined;
}

export function profileName(profile: RawUserProfile | undefined): string {
  return profile?.display_name || profile?.real_name || "";
}

export function mapUser(raw: RawUser): User {
  const isSlack = raw.id === SLACK_USER_ID;
  const realName = raw.profile?.real_name || raw.real_name;
  const name = raw.profile?.display_name || realName || raw.name;
  const customFields = mapCustomFields(raw.profile);
  const avatarUrl: string | undefined = isSlack
    ? SLACK_AVATAR_URL
    : raw.profile?.image_192 ||
      raw.profile?.image_72 ||
      raw.profile?.image_48 ||
      hashedAvatarUrl(raw) ||
      (raw.id === "USLACKBOT" ? SLACKBOT_AVATAR_URL : undefined);
  return {
    appId: raw.profile?.api_app_id || undefined,
    avatarColor: isSlack ? "transparent" : colorFromHex(raw.color),
    avatarUrl,
    botId: raw.profile?.bot_id || undefined,
    customFields,
    email: raw.profile?.email || undefined,
    id: parseUserId(raw.id),

    isBot: !!raw.is_bot || raw.id === "USLACKBOT" || isSlack,
    isWorkspaceAdmin: !!(raw.is_admin || raw.is_owner || raw.is_primary_owner),
    isWorkspaceOwner: !!(raw.is_owner || raw.is_primary_owner),
    name: name ?? "",
    phone: raw.profile?.phone || undefined,

    presence: raw.presence === "active" || raw.presence === "away" ? raw.presence : undefined,
    pronouns: raw.profile?.pronouns || undefined,
    realName: realName && realName !== name ? realName : undefined,
    startDate: mapStartDate(raw.profile),
    statusEmoji: raw.profile?.status_emoji || undefined,
    statusText: raw.profile?.status_text || undefined,
    title: raw.profile?.title || undefined,
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
  };
}
