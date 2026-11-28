import { Delta, type Op } from "@slock/ui/editor/quill";
import { escapeCanvasHtml } from "../../protocol/api";

export type EmbedValue = Record<string, unknown>;
type EmbedResolver = (controlId: string) => EmbedValue;
type EmbedSerializer = (embed: EmbedValue) => string | null;

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

const NBSP = "\u00a0";
const NEWLINE_RE = /\r?\n/;
const OPENING_TAG_RE = /<([^\s>]+)[^>]*>/g;

function escapeAttribute(text: string): string {
  return escapeCanvasHtml(text).replaceAll('"', "&quot;");
}

function pushText(ops: Op[], text: string, marks: Record<string, unknown>, code: boolean) {
  const insert = code ? text.replaceAll(NBSP, " ") : text;
  insert.split(NEWLINE_RE).forEach((part, index) => {
    if (index > 0) ops.push(op({ softbreak: true }, marks));
    if (part) ops.push(op(part, marks));
  });
}

function op(insert: NonNullable<Op["insert"]>, marks: Record<string, unknown>): Op {
  return Object.keys(marks).length > 0 ? { attributes: { ...marks }, insert } : { insert };
}

function openingTag(element: Element): string {
  const attributes = [...element.attributes].map(
    ({ name, value }) => ` ${name}="${escapeAttribute(value)}"`,
  );
  return `<${element.localName}${attributes.join("")}>`;
}

function joined(previous: unknown, next: string, separator: string): string {
  return typeof previous === "string" ? `${previous}${separator}${next}` : next;
}

function withElement(marks: Record<string, unknown>, element: Element): Record<string, unknown> {
  const tag = element.localName;
  const mark = MARK_TAGS[tag];
  if (mark) return { ...marks, [mark]: true };
  const href = element.getAttribute("href");
  if (tag === "a" && href) return { ...marks, link: href };
  const id = element.getAttribute("id");
  if (tag === "annotation" && id)
    return { ...marks, annotation: joined(marks.annotation, id, " ") };
  return { ...marks, htmltags: joined(marks.htmltags, openingTag(element), "") };
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
  if (node.localName === "br") ops.push(op({ softbreak: true }, marks));
  else if (node.localName === "control")
    ops.push(op(resolve(node.getAttribute("id") ?? ""), marks));
  else {
    const next = withElement(marks, node);
    for (const child of node.childNodes) walk(child, next, ops, resolve, code);
  }
}

export function htmlToOps(html: string, resolve: EmbedResolver, code: boolean): Op[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  const ops: Op[] = [];
  for (const child of template.content.childNodes) walk(child, {}, ops, resolve, code);
  const merged = new Delta();
  for (const entry of ops) merged.push(entry);
  return merged.ops;
}

interface Wrapper {
  close: string;
  open: string;
}

function attributeTag(tag: string, name: string, value: string): Wrapper {
  return { close: `</${tag}>`, open: `<${tag} ${name}="${escapeAttribute(value)}">` };
}

function wrappersFor({ annotation, htmltags, link, ...marks }: Record<string, unknown>) {
  const found: Wrapper[] = [];
  if (typeof annotation === "string")
    found.push(...annotation.split(" ").map((id) => attributeTag("annotation", "id", id)));
  if (typeof link === "string") found.push(attributeTag("a", "href", link));
  for (const [name, tag] of SERIALIZED_MARKS)
    if (marks[name]) found.push({ close: `</${tag}>`, open: `<${tag}>` });
  if (typeof htmltags === "string")
    for (const [open, tag] of htmltags.matchAll(OPENING_TAG_RE))
      found.push({ close: `</${tag}>`, open });
  return found;
}

// A tag shared by neighbouring runs stays open across them, so one comment or link is one element.
function nest(parts: { content: string; wrappers: Wrapper[] }[]): string {
  const open: Wrapper[] = [];
  const has = (list: Wrapper[], wrapper: Wrapper) => list.some((o) => o.open === wrapper.open);
  const close = (from: number) =>
    open
      .splice(from)
      .reverse()
      .map((wrapper) => wrapper.close)
      .join("");
  let html = "";
  parts.forEach(({ content, wrappers }, index) => {
    const stale = open.findIndex((wrapper) => !has(wrappers, wrapper));
    if (stale >= 0) html += close(stale);
    const runEnd = (wrapper: Wrapper) => {
      let end = index;
      while (has(parts[end]?.wrappers ?? [], wrapper)) end++;
      return end;
    };
    const added = wrappers.filter((wrapper) => !has(open, wrapper));
    for (const wrapper of added.sort((a, b) => runEnd(b) - runEnd(a))) {
      html += wrapper.open;
      open.push(wrapper);
    }
    html += content;
  });
  return html + close(0);
}

export function opsToHtml(ops: Op[], serializeEmbed: EmbedSerializer, code: boolean): string {
  const text = (raw: string) =>
    escapeCanvasHtml(code ? raw.replaceAll(" ", NBSP) : raw).replaceAll(NBSP, "&nbsp;");
  return nest(
    ops.flatMap(({ attributes, insert }) => {
      const content =
        typeof insert === "string" ? text(insert) : insert ? serializeEmbed(insert) : null;
      return content ? [{ content, wrappers: wrappersFor(attributes ?? {}) }] : [];
    }),
  );
}
