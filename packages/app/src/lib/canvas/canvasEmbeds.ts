import type { CanvasEmbed } from "@slock/canvas";
import type { CanvasControl } from "@slock/types";
import type { EmbedValue } from "./canvasHtml";

export interface CanvasNames {
  channel(id: string): string;
  controlLabel(embed: CanvasEmbed): string;
  emojiText(name: string): string | null;
  teamId: string;
  user(id: string): string;
}

export const CANVAS_DATE_FORMAT = "{date_short_pretty}";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function embedKey(embed: CanvasEmbed, controlId: string): string {
  switch (embed.type) {
    case "user":
      return `user:${embed.userId}`;
    case "channel":
      return `channel:${embed.channelId}`;
    case "emoji":
      return `emoji:${embed.shortcode}`;
    case "date":
      return `date:${Math.floor(embed.ms / 1000)}`;
    default:
      return `raw:${controlId}`;
  }
}

export function valueKey(value: EmbedValue): string | null {
  const { canvasControl, date, emoji, mention } = value;
  if (isRecord(mention) && isString(mention.id)) return `${mention.kind}:${mention.id}`;
  if (isRecord(emoji) && isString(emoji.name)) return `emoji:${emoji.name}`;
  if (isRecord(date) && typeof date.ts === "number") return `date:${date.ts}`;
  if (isRecord(canvasControl) && isString(canvasControl.id)) return `raw:${canvasControl.id}`;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function embedToValue(
  embed: CanvasEmbed | undefined,
  controlId: string,
  names: CanvasNames,
): EmbedValue {
  if (embed?.type === "user")
    return { mention: { id: embed.userId, kind: "user", name: names.user(embed.userId) } };
  if (embed?.type === "channel")
    return {
      mention: { id: embed.channelId, kind: "channel", name: names.channel(embed.channelId) },
    };
  if (embed?.type === "emoji" && embed.shortcode) return { emoji: { name: embed.shortcode } };
  if (embed?.type === "date") {
    return {
      date: {
        fallback: new Date(embed.ms).toLocaleDateString(),
        format: CANVAS_DATE_FORMAT,
        ts: Math.floor(embed.ms / 1000),
      },
    };
  }
  return {
    canvasControl: { id: controlId, label: embed ? names.controlLabel(embed) : "embedded content" },
  };
}

export function valueToControl(
  value: EmbedValue,
  id: string,
  names: CanvasNames,
): CanvasControl | null {
  const { date, emoji, mention } = value;
  if (isRecord(mention) && isString(mention.id)) {
    if (mention.kind === "user") return { id, kind: "user", userId: mention.id };
    if (mention.kind === "channel") return { channelId: mention.id, id, kind: "channel" };
  }
  if (isRecord(emoji) && isString(emoji.name))
    return { id, kind: "emoji", name: emoji.name, teamId: names.teamId };
  if (isRecord(date) && typeof date.ts === "number")
    return { id, kind: "date", ms: date.ts * 1000 };
  return null;
}
