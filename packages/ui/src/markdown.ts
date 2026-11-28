const BLOCK_SELECTOR = "address, article, div, footer, header, p, section, table, tbody, thead";
const QUOTE_SELECTOR = 'blockquote, [data-layout*="quote"]';
const SKIPPED_SELECTOR = "svg, script, style";
const HEADING_TAG_RE = /^H([1-6])$/;
const INVISIBLE_RE = /\u200B|\uFEFF/g;
const LINE_START_RE = /^/gm;
const TRAILING_NEWLINE_RE = /\n$/;

const MARKS: [selector: string, delimiter: string][] = [
  ["code, .bk-inline-code", "`"],
  ["s, del, strike, .bk-rt-strike", "~~"],
  ["i, em, .bk-rt-italic", "_"],
  ["b, strong, .bk-rt-bold", "**"],
];

interface Piece {
  block: boolean;
  text: string;
}

export function wrapDelimited(text: string, delimiter: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.length - text.trimStart().length);
  const trail = text.slice(lead.length + core.length);
  return `${lead}${delimiter}${core}${delimiter}${trail}`;
}

function cleanText(text: string): string {
  return text.replace(INVISIBLE_RE, "").replaceAll("\u00A0", " ");
}

function join(pieces: Piece[]): string {
  return pieces.reduce((out, piece, index) => {
    const broken = index > 0 && (piece.block || pieces[index - 1]?.block);
    const text = piece.block ? piece.text.replace(TRAILING_NEWLINE_RE, "") : piece.text;
    return `${out}${broken ? "\n" : ""}${text}`;
  }, "");
}

function childPieces(node: Node, verbatim: boolean): Piece[] {
  return Array.from(node.childNodes).flatMap((child) => pieceOf(child, verbatim));
}

function quoted(text: string): string {
  return text.replace(TRAILING_NEWLINE_RE, "").replace(LINE_START_RE, "> ");
}

function listMarker(item: Element, index: number): string {
  const check = item.getAttribute("data-list");
  if (check === "checked") return "- [x] ";
  if (check === "unchecked") return "- [ ] ";
  const list = item.parentElement;
  if (!(list instanceof HTMLOListElement)) return "- ";
  return `${list.start + index}. `;
}

function listText(list: Element, verbatim: boolean): string {
  const indent = "    ".repeat(Number(list.getAttribute("data-indent") ?? 0));
  return Array.from(list.children, (item, index) => {
    const marker = listMarker(item, index);
    const text = join(childPieces(item, verbatim));
    return `${indent}${marker}${text.replaceAll("\n", `\n${indent}${" ".repeat(marker.length)}`)}`;
  }).join("\n");
}

function rowText(row: HTMLTableRowElement, verbatim: boolean): string {
  const cells = Array.from(row.cells, (cell) =>
    join(childPieces(cell, verbatim)).trim().replaceAll("\n", " "),
  );
  const line = `| ${cells.join(" | ")} |`;
  return row.rowIndex === 0 ? `${line}\n|${" --- |".repeat(cells.length)}` : line;
}

function inlineText(el: Element, verbatim: boolean): string {
  let text = join(childPieces(el, verbatim));
  if (verbatim) return text;
  for (const [selector, delimiter] of MARKS) {
    if (el.matches(selector)) text = wrapDelimited(text, delimiter);
  }
  const href = el.matches("a") ? el.getAttribute("href") : null;
  if (!(href && text) || href === text || href === `${text}/`) return text;
  return `[${text}](${href})`;
}

function pieceOf(node: Node, verbatim: boolean): Piece[] {
  const inline = (text: string) => [{ block: false, text }];
  const block = (text: string) => [{ block: true, text }];
  if (node.nodeType === Node.TEXT_NODE) {
    const text = cleanText(node.textContent ?? "");
    return text ? inline(text) : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  const { copy, emojiName } = node.dataset;
  if (copy !== undefined) return inline(copy);
  if (emojiName) return inline(cleanText(node.textContent ?? "") || `:${emojiName}:`);
  if (node.matches(SKIPPED_SELECTOR)) return [];
  if (node.matches("br")) return inline("\n");
  if (node.matches("hr")) return block("---");
  if (node.matches("pre")) {
    const code = join(childPieces(node, true)).replace(TRAILING_NEWLINE_RE, "");
    return block(`\`\`\`\n${code}\n\`\`\``);
  }
  if (node.matches("ul, ol")) return block(listText(node, verbatim));
  // A selection spanning list items clones them without their list.
  if (node.matches("li")) return block(`- ${join(childPieces(node, verbatim))}`);
  if (node instanceof HTMLTableRowElement) return block(rowText(node, verbatim));
  if (node.matches(QUOTE_SELECTOR)) return block(quoted(join(childPieces(node, verbatim))));
  const heading = node.tagName.match(HEADING_TAG_RE)?.[1];
  if (heading) {
    return block(`${"#".repeat(Number(heading))} ${join(childPieces(node, verbatim))}`);
  }
  if (!node.matches(BLOCK_SELECTOR)) return inline(inlineText(node, verbatim));
  const text = join(childPieces(node, verbatim));
  return text || node.matches("p") ? block(text) : [];
}

export function domToMarkdown(root: Node): string {
  return join(childPieces(root, false));
}
