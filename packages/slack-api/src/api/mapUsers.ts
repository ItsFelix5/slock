import type { User, UserCustomField } from "../types";
import type { RawBot, RawUser, RawUserProfile } from "./rawTypes";
import { resolveMediaUrl } from "./server";

const SLACK_USER_ID = "USLACK";
const SLACK_AVATAR_URL = "/slack-logo.svg";

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : "#616061";
}

function tzLabelFromOffset(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return;
  const hours = seconds / 3600;
  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const whole = Math.floor(abs);
  const minutes = Math.round((abs - whole) * 60);
  return `UTC${sign}${whole}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function avatarUrlFromHash(raw: RawUser): string | undefined {
  const hash = raw.profile?.avatar_hash;
  const team = raw.profile?.team ?? raw.team_id;
  if (!(hash && team)) return;
  return `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192`;
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

export function mapUser(raw: RawUser): User {
  const isSlack = raw.id === SLACK_USER_ID;
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  const customFields = mapCustomFields(raw.profile);
  const avatarUrl: string | undefined = isSlack
    ? SLACK_AVATAR_URL
    : raw.profile?.image_192 ||
      raw.profile?.image_72 ||
      raw.profile?.image_48 ||
      avatarUrlFromHash(raw);
  return {
    appId: raw.profile?.api_app_id || undefined,
    avatarColor: isSlack ? "transparent" : colorFromHex(raw.color),
    avatarUrl,
    botId: raw.profile?.bot_id || undefined,
    customFields,
    email: raw.profile?.email || undefined,
    id: raw.id,

    isBot: !!raw.is_bot || raw.id === "USLACKBOT" || isSlack,
    isWorkspaceAdmin: !!(raw.is_admin || raw.is_owner || raw.is_primary_owner),
    lastSeen: raw.last_seen || undefined,
    name: name ?? "",
    phone: raw.profile?.phone || undefined,

    presence: raw.presence === "active" || raw.presence === "away" ? raw.presence : undefined,
    pronouns: raw.profile?.pronouns || undefined,
    startDate: mapStartDate(raw.profile),
    statusEmoji: raw.profile?.status_emoji || undefined,
    statusText: raw.profile?.status_text || undefined,
    title: raw.profile?.title || undefined,
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
  };
}

export function mapBot(raw: RawBot): User {
  const rawIcon = raw.icons?.image_72 ?? raw.icons?.image_48 ?? raw.icons?.image_36;
  return {
    appId: raw.app_id || undefined,
    avatarColor: "#616061",
    avatarUrl: rawIcon ? resolveMediaUrl(rawIcon) : undefined,
    botId: raw.id,
    id: raw.id,
    isBot: true,
    name: raw.name ?? "",
    presence: "active",
  };
}
