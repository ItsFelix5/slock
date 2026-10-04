import type { Op } from "quill";

export type EmbedValue = Record<string, unknown>;
export type EmbedResolver = (controlId: string) => EmbedValue;
export type EmbedSerializer = (embed: EmbedValue) => string | null;

const MARK_TAGS: Record<string, string> = {
  b: "bold",
  code: "code",
  del: "strike",
  em: "italic",
  i: "italic",
  s: "strike",
  strike: "strike",
  strong: "bold",
  u: "underline",
};

const SERIALIZED_MARKS = [
  ["code", "code"],
  ["strike", "del"],
  ["underline", "u"],
  ["italic", "i"],
  ["bold", "b"],
] as const;

const AMPERSAND_RE = /&/g;
const LESS_THAN_RE = /</g;
const GREATER_THAN_RE = />/g;
const QUOTE_RE = /"/g;
const SPACE_RE = / /g;
const NBSP_RE = /\u00a0/g;

export function escapeHtml(text: string): string {
  return text
    .replace(AMPERSAND_RE, "&amp;")
    .replace(LESS_THAN_RE, "&lt;")
    .replace(GREATER_THAN_RE, "&gt;");
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replace(QUOTE_RE, "&quot;");
}

function pushText(ops: Op[], text: string, marks: Record<string, unknown>, code: boolean) {
  if (!text) return;
  const insert = code ? text.replace(NBSP_RE, " ") : text;
  ops.push(Object.keys(marks).length > 0 ? { attributes: { ...marks }, insert } : { insert });
}

function walk(
  node: Node,
  marks: Record<string, unknown>,
  ops: Op[],
  resolve: EmbedResolver,
  code: boolean,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    pushText(ops, node.textContent ?? "", marks, code);
    return;
  }
  if (!(node instanceof Element)) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    ops.push({ insert: { softbreak: true } });
    return;
  }
  if (tag === "control") {
    ops.push({ insert: resolve(node.getAttribute("id") ?? "") });
    return;
  }
  const mark = MARK_TAGS[tag];
  const href = tag === "a" ? node.getAttribute("href") : null;
  const next = mark ? { ...marks, [mark]: true } : href ? { ...marks, link: href } : marks;
  for (const child of node.childNodes) walk(child, next, ops, resolve, code);
}

export function htmlToOps(html: string, resolve: EmbedResolver, code: boolean): Op[] {
  const { body } = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const ops: Op[] = [];
  for (const child of body.childNodes) walk(child, {}, ops, resolve, code);
  return ops;
}

function wrapText(text: string, attributes: Record<string, unknown>): string {
  let out = escapeHtml(text);
  if (typeof attributes.link === "string")
    out = `<a href="${escapeAttribute(attributes.link)}">${out}</a>`;
  for (const [name, tag] of SERIALIZED_MARKS.toReversed()) {
    if (attributes[name]) out = `<${tag}>${out}</${tag}>`;
  }
  return out;
}

export function opsToHtml(ops: Op[], serializeEmbed: EmbedSerializer, code: boolean): string {
  let html = "";
  for (const op of ops) {
    if (typeof op.insert === "string") {
      const text = code ? op.insert.replace(SPACE_RE, "\u00a0") : op.insert;
      html += wrapText(text, op.attributes ?? {}).replace(NBSP_RE, "&nbsp;");
    } else if (op.insert) {
      html += serializeEmbed(op.insert) ?? "";
    }
  }
  return html;
}
