import type { ChannelId } from "@slock/types";

const FILE_MODIFIERS = ["type", "creator"] as const;
const MESSAGE_MODIFIERS = ["with", "has", "hasmy", "is"] as const;

const MODIFIERS = [
  "from",
  "in",
  "during",
  "on",
  "after",
  "before",
  ...MESSAGE_MODIFIERS,
  ...FILE_MODIFIERS,
] as const;
export type Modifier = (typeof MODIFIERS)[number];

export const SCOPES = [
  "all",
  "messages",
  "files",
  "canvases",
  "lists",
  "people",
  "channels",
] as const;
export type Scope = (typeof SCOPES)[number];

const PREFIX_SCOPES: Record<string, Scope> = { "@": "people", "#": "channels", "§": "files" };

export const SORT_MODES = ["relevant", "newest", "oldest"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export interface SearchInputs {
  excludeBots: boolean;
  myChannels: boolean;
  query: string;
  scope: Scope;
  sort: SortMode;
}

export interface SearchRequest extends SearchInputs {
  jumpOnly: boolean;
  term: string;
}

export const DEFAULT_INPUTS: SearchInputs = {
  excludeBots: false,
  myChannels: false,
  query: "",
  scope: "all",
  sort: "relevant",
};

export interface QueryToken {
  end: number;
  modifier: Modifier;
  negated: boolean;
  start: number;
  value: string;
}

const MODIFIER_GROUP = `(${MODIFIERS.join("|")})`;
const UNFINISHED_TOKEN = new RegExp(`(?<=^|\\s)-?${MODIFIER_GROUP}:[@#]?(?=\\s|$)`, "gi");

const tokenPattern = () => new RegExp(`(?<=^|\\s)(-)?${MODIFIER_GROUP}:(<[^>]*>|\\S+)`, "gi");

export function parseTokens(query: string): QueryToken[] {
  return [...query.matchAll(tokenPattern())].flatMap((match) => {
    const [whole, negation, name = "", value = ""] = match;
    const modifier = MODIFIERS.find((known) => known === name.toLowerCase());
    if (!modifier) return [];
    const start = match.index;
    return [{ end: start + whole.length, modifier, negated: !!negation, start, value }];
  });
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function rewriteTokens(query: string, rewrite: (token: QueryToken) => string): string {
  let result = "";
  let copied = 0;
  for (const token of parseTokens(query)) {
    result += query.slice(copied, token.start) + rewrite(token);
    copied = token.end;
  }
  return collapseSpaces(result + query.slice(copied));
}

const writeToken = ({ modifier, negated, value }: QueryToken) =>
  `${negated ? "-" : ""}${modifier}:${value}`;

export const freeText = (query: string) => rewriteTokens(query, () => "");

const normalizeQuery = (query: string) => rewriteTokens(query, writeToken);

export const withoutModifier = (query: string, modifier: Modifier) =>
  rewriteTokens(query, (token) => (token.modifier === modifier ? "" : writeToken(token)));

function scopeForTokens(selected: Scope, query: string): Scope {
  const used = new Set(parseTokens(query).map((token) => token.modifier));
  if (FILE_MODIFIERS.some((modifier) => used.has(modifier))) {
    return selected === "all" || selected === "messages" ? "files" : selected;
  }
  if (MESSAGE_MODIFIERS.some((modifier) => used.has(modifier))) {
    return selected === "all" || selected === "files" ? "messages" : selected;
  }
  return selected === "all" && used.size > 0 ? "messages" : selected;
}

export function resolveRequest(inputs: SearchInputs, jumpOnly = false): SearchRequest {
  let query = normalizeQuery(inputs.query.replace(UNFINISHED_TOKEN, ""));
  const marked = PREFIX_SCOPES[query.charAt(0)];
  const prefixed = inputs.scope === "all" || inputs.scope === marked ? marked : undefined;
  if (prefixed) query = query.slice(1).trim();
  let scope = prefixed ?? scopeForTokens(inputs.scope, query);
  if (jumpOnly && scope !== "people" && scope !== "channels") scope = "all";
  return { ...inputs, jumpOnly, query, scope, term: freeText(query) };
}

export function buildSearchQuery(query: string, inChannelId?: ChannelId): string {
  const filter = inChannelId ? `in:<#${inChannelId}>` : "";
  return [query.trim(), filter].filter(Boolean).join(" ");
}

interface SortParams {
  sort: "score" | "timestamp";
  sortDir: "asc" | "desc";
}

const SORT_PARAMS: Record<SortMode, SortParams> = {
  newest: { sort: "timestamp", sortDir: "desc" },
  oldest: { sort: "timestamp", sortDir: "asc" },
  relevant: { sort: "score", sortDir: "desc" },
};

export const sortParams = (mode: SortMode) => SORT_PARAMS[mode];
