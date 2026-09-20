const USER_PROFILE_LINK_RE =
  /^https:\/\/[a-z0-9-]+(?:\.enterprise)?\.slack\.com\/team\/([A-Z0-9]+)(?:[/?#].*)?$/i;

export function parseUserProfileLink(url: string): string | null {
  return USER_PROFILE_LINK_RE.exec(url)?.[1] ?? null;
}

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
  | { t: "canvas"; fileId: string; label?: string }
  | {
      t: "date";
      timestamp: number;
      format: string;
      url?: string;
      fallback?: string;
    };

const INLINE_RE =
  /`([^`]+)`|<([^<>]*)>|:([a-z0-9_+'-]+):|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^\n]+?)_(?![\p{L}\p{N}])|~([^~\n]+)~|(https?:\/\/[^\s<>]+)/giu;
const TRAILING_PUNCTUATION_RE = /[),.!?;:'"]+$/;

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
  if (token.startsWith("!canvas^")) {
    const [fileId, label] = splitOnce(token.slice("!canvas^".length), "|");
    return { fileId, label, t: "canvas" };
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
    const [, code, token, emoji, doubleBold, bold, italic, strike, bareUrl] = match;
    if (code !== undefined) nodes.push({ nodes: parseCodeInner(code), t: "code" });
    else if (token !== undefined) nodes.push(parseToken(token));
    else if (emoji !== undefined) nodes.push({ name: emoji, t: "emoji" });
    else if (doubleBold !== undefined || bold !== undefined)
      nodes.push({ nodes: parseInline(doubleBold ?? bold), t: "bold" });
    else if (italic !== undefined) nodes.push({ nodes: parseInline(italic), t: "italic" });
    else if (strike !== undefined) nodes.push({ nodes: parseInline(strike), t: "strike" });
    else if (bareUrl !== undefined) {
      const trail = bareUrl.match(TRAILING_PUNCTUATION_RE)?.[0] ?? "";
      nodes.push({ t: "link", url: trail ? bareUrl.slice(0, -trail.length) : bareUrl });
      if (trail) nodes.push({ t: "text", text: trail });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}
