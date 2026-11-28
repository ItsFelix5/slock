import { decodeTextEntities } from "@slock/slack";

const TOKEN_RE = /<[^>]*>|[^<]+/g;
const TAG_RE = /^<(\/?)([a-z-]+)/i;
const TARGET_RE = /(?:href|id)="([^"]*)"/;
const TAG_ALIASES: Record<string, string> = { del: "s", em: "i", strike: "s", strong: "b" };

interface HtmlTag {
  closing: boolean;
  name: string;
  target: string;
}

type HtmlToken = { tag: HtmlTag } | { text: string };

function plainText(raw: string): string {
  return decodeTextEntities(raw.replaceAll("&nbsp;", " ")).replaceAll(" ", " ");
}

export function htmlTokens(html: string): HtmlToken[] {
  return [...html.matchAll(TOKEN_RE)].map(([token]) => {
    const match = token.match(TAG_RE);
    if (!match) return { text: plainText(token) };
    const [, slash, name = ""] = match;
    return {
      tag: {
        closing: !!slash,
        name: TAG_ALIASES[name] ?? name,
        target: token.match(TARGET_RE)?.[1] ?? "",
      },
    };
  });
}
