import { service } from "@slock/core/solid";
import { isChannelId, isUserId } from "@slock/slack";
import { type QueryToken, rewriteTokens } from "../../searchQuery";

const channelsStore = service("channels");
const usersStore = service("users");

export interface FilterPill {
  label: string;
  negated: boolean;
  token: string;
}

const PEOPLE_MODIFIERS: ReadonlySet<string> = new Set(["creator", "from", "with"]);
const LEADING_AT_RE = /^@/;
const ENTITY_RE = /^<([@#])([A-Z0-9]+)(?:\|[^>]*)?>$/;

function entityName(value: string): string | undefined {
  const [, sigil, id = ""] = value.match(ENTITY_RE) ?? [];
  if (sigil === "@") {
    return `@${(isUserId(id) ? usersStore.userById(id)?.name : undefined) ?? id}`;
  }
  if (sigil !== "#") return;
  return `#${(isChannelId(id) ? channelsStore.channelById(id)?.name : undefined) ?? id}`;
}

const tokenLabel = ({ modifier, value }: QueryToken) => `${modifier}:${entityName(value) ?? value}`;

function personValue(value: string): string | undefined {
  if (ENTITY_RE.test(value)) return value;
  const name = value.replace(LEADING_AT_RE, "");
  if (name.toLowerCase() === "me") return "me";
  const id = usersStore.userIdByName(name);
  return id && `<@${id}>`;
}

export function tokenPill(token: QueryToken): FilterPill | undefined {
  const { modifier, negated } = token;
  const value = PEOPLE_MODIFIERS.has(modifier) ? personValue(token.value) : token.value;
  if (!value) return;
  return {
    label: tokenLabel({ ...token, value }),
    negated,
    token: `${modifier}:${value}`,
  };
}

export const readableQuery = (query: string) =>
  rewriteTokens(query, (token) => `${token.negated ? "-" : ""}${tokenLabel(token)}`);
