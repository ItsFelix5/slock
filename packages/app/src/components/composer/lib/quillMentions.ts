import Quill from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { suggestionText } from "./suggestionController";
import type { SuggestItem, SuggestState } from "./suggestTypes";

interface MentionValue {
  kind: "user" | "channel";
  id: string;
  name: string;
}

function mentionValue(value: unknown): MentionValue | undefined {
  if (!value || typeof value !== "object") return;
  const { kind, id, name } = value as Record<string, unknown>;
  return (kind === "user" || kind === "channel") &&
    typeof id === "string" &&
    typeof name === "string"
    ? { id, kind, name }
    : undefined;
}

const Embed = Quill.import("blots/embed") as typeof import("quill/blots/embed").default;

class MentionBlot extends Embed {
  static blotName = "mention";
  static tagName = "span";

  static create(value: MentionValue) {
    const node = super.create(value) as HTMLElement;
    node.className = "bk-mention";
    node.dataset.kind = value.kind;
    node.dataset.id = value.id;
    node.dataset.name = value.name;
    node.textContent = `${value.kind === "user" ? "@" : "#"}${value.name}`;
    return node;
  }

  static value(node: HTMLElement): MentionValue | undefined {
    const { kind, id, name } = node.dataset;
    return kind === "user" || kind === "channel"
      ? { id: id ?? "", kind, name: name ?? "" }
      : undefined;
  }
}

Quill.register(MentionBlot);

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : "\uFFFC"))
    .join("");
}

export function mrkdwnText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => {
      if (typeof op.insert === "string") return op.insert;
      const mention = mentionValue(op.insert?.mention);
      if (!mention) return "";
      return mention.kind === "user" ? `<@${mention.id}>` : `<#${mention.id}|${mention.name}>`;
    })
    .join("");
}

const MENTION_TOKEN_RE = /<@([A-Z0-9]+)>|<#([A-Z0-9]+)(?:\|([^>]*))?>/g;

export function loadMrkdwnIntoQuill(quill: Quill, text: string): void {
  quill.setText("\n");
  if (!text) return;
  let cursor = 0;
  let lastIndex = 0;
  const insertPlain = (segment: string) => {
    if (!segment) return;
    quill.insertText(cursor, segment);
    cursor += segment.length;
  };
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const [whole, userId, channelId, channelLabel] = match;
    const index = match.index ?? 0;
    insertPlain(text.slice(lastIndex, index));
    if (userId) {
      const name = store.users.userById(userId)?.name ?? userId;
      quill.insertEmbed(cursor, "mention", { id: userId, kind: "user", name });
      cursor += 1;
    } else if (channelId) {
      const name =
        channelLabel || channelDisplayName(store.channels.channelById(channelId), channelId);
      quill.insertEmbed(cursor, "mention", { id: channelId, kind: "channel", name });
      cursor += 1;
    }
    lastIndex = index + whole.length;
  }
  insertPlain(text.slice(lastIndex));
}

export function insertSuggestionAt(
  quill: Quill,
  start: number,
  deleteCount: number,
  item: SuggestItem,
  kind: SuggestState["kind"],
): number {
  quill.deleteText(start, deleteCount);
  if ((item.kind === "user" && kind !== "userlink") || item.kind === "channel") {
    quill.insertEmbed(start, "mention", { id: item.id, kind: item.kind, name: item.name });
    quill.insertText(start + 1, " ");
    return start + 2;
  }
  const text = suggestionText(item, kind);
  quill.insertText(start, text);
  return start + text.length;
}
