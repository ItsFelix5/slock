import { isRecord } from "@slock/core";
import Quill, { Delta, getEmbedBlot } from "@slock/ui/editor/quill";
import { parseTokens } from "../../searchQuery";
import { type FilterPill, tokenPill } from "./pillLabels";

class FilterPillBlot extends getEmbedBlot() {
  static override blotName = "filter";
  static override tagName = "span";

  static override create(value: FilterPill) {
    const node = document.createElement("span");
    node.className = "bk-mention search-filter-pill";
    node.classList.toggle("negated", value.negated);
    node.dataset.token = value.token;
    node.dataset.label = value.label;
    node.dataset.negated = String(value.negated);
    node.textContent = value.negated ? `-${value.label}` : value.label;
    node.dataset.copy = node.textContent;
    node.contentEditable = "false";
    return node;
  }

  static override value(node: HTMLElement): FilterPill | undefined {
    const { token, label, negated } = node.dataset;
    return token && label ? { label, negated: negated === "true", token } : undefined;
  }
}

Quill.register(FilterPillBlot);

export function pillOf(insert: unknown): FilterPill | undefined {
  if (!(isRecord(insert) && isRecord(insert.filter))) return;
  const { label, negated, token } = insert.filter;
  return typeof token === "string" && typeof label === "string"
    ? { label, negated: !!negated, token }
    : undefined;
}

export function wholeTokenPill(text: string): FilterPill | undefined {
  const [token] = parseTokens(text);
  if (token?.start !== 0 || token.end !== text.length) return;
  return tokenPill(token);
}

const REPEATED_SPACE_RE = / {2,}/g;
const LEADING_SPACE_RE = /^ /;

export function serializeQuery(quill: Quill): string {
  const serialized = quill
    .getContents()
    .ops.map((op) => {
      if (typeof op.insert === "string") return op.insert;
      const pill = pillOf(op.insert);
      return pill ? ` ${pill.negated ? "-" : ""}${pill.token} ` : "";
    })
    .join("")
    .replace(REPEATED_SPACE_RE, " ")
    .replace(LEADING_SPACE_RE, "");
  return serialized.endsWith("\n") ? serialized.slice(0, -1) : serialized;
}

export function loadQueryIntoQuill(quill: Quill, text: string): void {
  const delta = new Delta();
  let copied = 0;
  for (const token of parseTokens(text)) {
    const pill = tokenPill(token);
    if (!pill) continue;
    delta.insert(text.slice(copied, token.start)).insert({ filter: pill });
    copied = token.end;
  }
  quill.setContents(delta.insert(`${text.slice(copied)}\n`));
}
