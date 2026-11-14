import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/slack";

export interface MentionValue {
  kind: "user" | "channel" | "special" | "usergroup" | "userlink" | "messagelink";
  id: string;
  name: string;
}

export interface DateValue {
  ts: number;
  format: string;
  fallback: string;
}

export interface EmbedInsert {
  mention?: MentionValue;
  emoji?: string;
  date?: DateValue;
  divider?: boolean;
}

const MENTION_KINDS: MentionValue["kind"][] = [
  "user",
  "channel",
  "special",
  "usergroup",
  "userlink",
  "messagelink",
];

export const MENTION_PREFIX: Record<MentionValue["kind"], string> = {
  channel: "#",
  special: "@",
  user: "@",
  usergroup: "@",
  userlink: "@",
  messagelink: "",
};

export function isMentionKind(kind: unknown): kind is MentionValue["kind"] {
  return MENTION_KINDS.some((candidate) => candidate === kind);
}

function mentionValue(value: unknown): MentionValue | undefined {
  if (!(value && typeof value === "object" && "kind" in value && "id" in value && "name" in value))
    return;
  const { kind, id, name } = value;
  return isMentionKind(kind) && typeof id === "string" && typeof name === "string"
    ? { id, kind, name }
    : undefined;
}

export function dateValue(value: unknown): DateValue | undefined {
  if (
    !(
      value &&
      typeof value === "object" &&
      "ts" in value &&
      "format" in value &&
      "fallback" in value
    )
  )
    return;
  const { ts, format, fallback } = value;
  return typeof ts === "number" && typeof format === "string" && typeof fallback === "string"
    ? { fallback, format, ts }
    : undefined;
}

export function emojiValue(value: unknown): string | undefined {
  if (!(value && typeof value === "object" && "name" in value)) return;
  return typeof value.name === "string" ? value.name : undefined;
}

export function dateMrkdwn(value: DateValue): string {
  return `<!date^${value.ts}^${value.format}|${value.fallback}>`;
}

export function describeEmbed(insert: Record<string, unknown>): EmbedInsert | undefined {
  const mention = mentionValue(insert.mention);
  if (mention) return { mention };
  const emoji = emojiValue(insert.emoji);
  if (emoji) return { emoji };
  const date = dateValue(insert.date);
  if (date) return { date };
  if (insert.divider) return { divider: true };
}

export function embedText(embed: EmbedInsert): string {
  if (embed.mention) {
    if (embed.mention.kind === "user") return `<@${embed.mention.id}>`;
    if (embed.mention.kind === "special") return `<!${embed.mention.id}>`;
    if (embed.mention.kind === "usergroup") return `<!subteam^${embed.mention.id}>`;
    if (embed.mention.kind === "userlink") {
      const url = userProfileUrl(getCachedWorkspaceDomain() ?? "", embed.mention.id);
      return `<${url}|@${embed.mention.name}>`;
    }
    if (embed.mention.kind === "messagelink") return `<${embed.mention.id}>`;
    return `<#${embed.mention.id}|${embed.mention.name}>`;
  }
  if (embed.emoji) return `:${embed.emoji}:`;
  if (embed.date) return dateMrkdwn(embed.date);
  if (embed.divider) return "---";
  return "";
}
