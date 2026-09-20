import { getEmbedBlot } from "@slock/ui";
import Quill from "quill";

export interface FilterPillValue {
  token: string;
  label: string;
  negated: boolean;
}

export class FilterPillBlot extends getEmbedBlot() {
  static blotName = "filter";
  static tagName = "span";

  static create(value: FilterPillValue) {
    const node = document.createElement("span");
    node.className = "bk-mention search-filter-pill";
    node.classList.toggle("negated", value.negated);
    node.dataset.token = value.token;
    node.dataset.label = value.label;
    node.dataset.negated = String(value.negated);
    node.textContent = value.negated ? `-${value.label}` : value.label;
    node.title = "Click to change";
    node.contentEditable = "false";
    return node;
  }

  static value(node: HTMLElement): FilterPillValue | undefined {
    const { token, label, negated } = node.dataset;
    return token && label ? { label, negated: negated === "true", token } : undefined;
  }
}

Quill.register(FilterPillBlot);

function isPillShaped(
  value: unknown,
): value is { token?: unknown; label?: unknown; negated?: unknown } {
  return !!value && typeof value === "object";
}

export function filterPillValue(value: unknown): FilterPillValue | undefined {
  if (!isPillShaped(value)) return;
  const { token, label, negated } = value;
  return typeof token === "string" && typeof label === "string"
    ? { label, negated: !!negated, token }
    : undefined;
}

function isFilterOp(value: unknown): value is { filter?: unknown } {
  return !!value && typeof value === "object";
}

export function filterPillFromOpInsert(insert: unknown): FilterPillValue | undefined {
  return isFilterOp(insert) ? filterPillValue(insert.filter) : undefined;
}

const MODIFIER_RE = /(-)?(from|with|in|has|hasmy|is|during|after|before|type):(<[^>]+>|\S+)/;
const TRAILING_NEWLINE_RE = /\n$/;

export function suggestionToPill(
  value: string,
  label: string,
): { pill: FilterPillValue } | undefined {
  const match = value.match(MODIFIER_RE);
  if (!match || match[0] !== value) return;
  const negated = !!match[1];
  const token = negated ? value.slice(1) : value;
  const cleanLabel = negated ? label.slice(1) : label;
  return { pill: { label: cleanLabel, negated, token } };
}

export function serializeQuery(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => {
      if (typeof op.insert === "string") return op.insert;
      const pill = filterPillFromOpInsert(op.insert);
      return pill ? `${pill.negated ? "-" : ""}${pill.token}` : "";
    })
    .join("")
    .replace(TRAILING_NEWLINE_RE, "");
}

export function loadQueryIntoQuill(
  quill: Quill,
  text: string,
  resolveLabel: (token: string) => string,
): void {
  quill.setText("\n");
  if (!text) return;
  const re = new RegExp(MODIFIER_RE, "g");
  let cursor = 0;
  let lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const [whole, negatedFlag] = match;
    const index = match.index ?? 0;
    const before = text.slice(lastIndex, index);
    if (before) {
      quill.insertText(cursor, before);
      cursor += before.length;
    }
    const negated = !!negatedFlag;
    const token = negated ? whole.slice(1) : whole;
    quill.insertEmbed(cursor, "filter", { label: resolveLabel(token), negated, token });
    cursor += 1;
    lastIndex = index + whole.length;
  }
  const rest = text.slice(lastIndex);
  if (rest) quill.insertText(cursor, rest);
}
