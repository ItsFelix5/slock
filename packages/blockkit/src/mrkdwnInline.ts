// biome-ignore-all lint/performance/useTopLevelRegex: The global expressions are cloned by matchAll.
import { parseUserProfileLink } from "./userProfileLink";

export type InlineNode =
  | { t: "text"; text: string }
  | { t: "bold"; nodes: InlineNode[] }
  | { t: "italic"; nodes: InlineNode[] }
  | { t: "strike"; nodes: InlineNode[] }
  | { t: "code"; nodes: InlineNode[] }
  | { t: "emoji"; name: string }
  | { t: "link"; url: string; label?: string }
  | { t: "userlink"; id: string; label?: string; url: string }
  | { t: "user"; id: string }
  | { t: "channel"; id: string; label?: string }
  | { t: "usergroup"; id: string; label?: string }
  | { t: "broadcast"; range: string }
  | {
      t: "date";
      timestamp: number;
      format: string;
      url?: string;
      fallback?: string;
    };

// Formatting delimiters must sit at word boundaries. In particular, an
// underscore inside `pending_staff` is content, while the trailing underscore
// in `_Status: pending_staff_` closes the italic run.
const INLINE_RE =
  /`([^`]+)`|<([^<>]*)>|:([a-z0-9_+'-]+):|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^\n]+?)_(?![\p{L}\p{N}])|~([^~\n]+)~/giu;

// Link/mention labels can themselves contain a literal "|" (a price, a
// range, ...), so only the first "|" in a token is the field separator —
// `token.split("|")` would silently truncate a label at its own pipe.
function splitOnce(text: string, sep: string): [string, string | undefined] {
  const index = text.indexOf(sep);
  return index === -1 ? [text, undefined] : [text.slice(0, index), text.slice(index + sep.length)];
}

function parseToken(token: string): InlineNode {
  if (token.startsWith("@")) {
    const [id] = splitOnce(token.slice(1), "|");
    return { id, t: "user" };
  }
  if (token.startsWith("#")) {
    const [id, label] = splitOnce(token.slice(1), "|");
    return { id, label, t: "channel" };
  }
  if (token.startsWith("!subteam^")) {
    const [id, label] = splitOnce(token.slice("!subteam^".length), "|");
    return { id, label, t: "usergroup" };
  }
  if (token.startsWith("!date^")) {
    const [main, fallback] = splitOnce(token.slice("!date^".length), "|");
    const [ts, format, url] = main.split("^");
    return { fallback, format, t: "date", timestamp: Number(ts), url };
  }
  if (token.startsWith("!")) {
    const [range] = splitOnce(token.slice(1), "|");
    if (range === "here" || range === "channel" || range === "everyone")
      return { range, t: "broadcast" };
    return { t: "text", text: `<${token}>` };
  }
  const [url, label] = splitOnce(token, "|");
  const userId = parseUserProfileLink(url);
  return userId ? { id: userId, label, t: "userlink", url } : { label, t: "link", url };
}

// Backticks suppress formatting but Slack still resolves its special `<...>`
// tokens inside inline code.
const CODE_TOKEN_RE = /<([^<>]*)>/g;

function parseCodeInner(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push({ t: "text", text: text.slice(lastIndex, index) });
    nodes.push(parseToken(match[1]));
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push({ t: "text", text: text.slice(lastIndex, index) });
    const [, code, token, emoji, doubleBold, bold, italic, strike] = match;
    if (code !== undefined) nodes.push({ nodes: parseCodeInner(code), t: "code" });
    else if (token !== undefined) nodes.push(parseToken(token));
    else if (emoji !== undefined) nodes.push({ name: emoji, t: "emoji" });
    else if (doubleBold !== undefined || bold !== undefined)
      nodes.push({ nodes: parseInline(doubleBold ?? bold), t: "bold" });
    else if (italic !== undefined) nodes.push({ nodes: parseInline(italic), t: "italic" });
    else if (strike !== undefined) nodes.push({ nodes: parseInline(strike), t: "strike" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}
