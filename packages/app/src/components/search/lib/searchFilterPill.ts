import Quill from "quill";

export interface FilterPillValue {
  token: string;
  label: string;
  negated: boolean;
}

const Embed = Quill.import("blots/embed") as typeof import("quill/blots/embed").default;

export class FilterPillBlot extends Embed {
  static blotName = "filter";
  static tagName = "span";

  static create(value: FilterPillValue) {
    const node = super.create(value) as HTMLElement;
    node.className = "bk-mention search-filter-pill";
    node.classList.toggle("negated", value.negated);
    node.dataset.token = value.token;
    node.dataset.label = value.label;
    node.dataset.negated = String(value.negated);
    node.textContent = value.label;
    return node;
  }

  static value(node: HTMLElement): FilterPillValue | undefined {
    const { token, label, negated } = node.dataset;
    return token && label ? { label, negated: negated === "true", token } : undefined;
  }
}

Quill.register(FilterPillBlot);

export function filterPillValue(value: unknown): FilterPillValue | undefined {
  if (!value || typeof value !== "object") return;
  const { token, label, negated } = value as Record<string, unknown>;
  return typeof token === "string" && typeof label === "string"
    ? { label, negated: !!negated, token }
    : undefined;
}

const MODIFIER_RE = /(-)?(from|with|in|has|hasmy|is|during|after|before|type):(\S+)/;
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
      const pill = op.insert ? filterPillValue(op.insert.filter) : undefined;
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
