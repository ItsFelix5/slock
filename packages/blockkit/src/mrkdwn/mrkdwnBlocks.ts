import { defined } from "@slock/core";
import { decodeTextEntities } from "@slock/slack";
import { type InlineNode, parseInline } from "./mrkdwnInline";

export type BlockNode =
  | { t: "lines"; nodes: InlineNode[] }
  | { t: "quote"; nodes: InlineNode[] }
  | { t: "codeblock"; text: string };

const QUOTE_LINE_RE = /^&gt;\s?/;
const CODE_FENCE_RE = /```([\s\S]*?)```/g;

function parseLinesAndQuotes(text: string): BlockNode[] {
  const groups: BlockNode[] = [];
  let current: string[] = [];
  let currentIsQuote = false;

  const flush = () => {
    if (current.length === 0) return;
    groups.push({
      nodes: parseInline(current.join("\n")),
      t: currentIsQuote ? "quote" : "lines",
    });
    current = [];
  };

  for (const line of text.split("\n")) {
    const isQuote = QUOTE_LINE_RE.test(line);
    if (isQuote !== currentIsQuote) flush();
    currentIsQuote = isQuote;
    current.push(isQuote ? line.replace(QUOTE_LINE_RE, "") : line);
  }
  flush();
  return groups;
}

function stripSurroundingNewline(text: string): string {
  const start = text.startsWith("\n") ? 1 : 0;
  const end = text.endsWith("\n") ? -1 : text.length;
  return text.slice(start, end);
}

export function parseMrkdwn(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex, index)));
    blocks.push({
      t: "codeblock",
      text: decodeTextEntities(stripSurroundingNewline(defined(match[1]))),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex)));
  return blocks;
}
