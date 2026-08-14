/** Data payloads for the composer's inline "atom" runs (@slock/ui's richtext doc model is
 * Slack-agnostic — these shapes are blockkit's concrete fill-in for the `Atom` generic). */

export interface MentionAtomData {
  target: "user" | "channel";
  refId: string;
  fallbackText: string;
}

export interface EmojiAtomData {
  name: string;
  unicode?: string;
  fallbackText: string;
}

export interface DateAtomData {
  timestamp: number;
  format: string;
  fallback?: string;
  url?: string;
  fallbackText: string;
}

export type ComposeAtomData = MentionAtomData | EmojiAtomData | DateAtomData;

export const ATOM_MENTION = "mention";
export const ATOM_EMOJI = "emoji";
export const ATOM_DATE = "date";
