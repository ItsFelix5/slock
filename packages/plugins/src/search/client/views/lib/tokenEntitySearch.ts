import { defined } from "@slock/core";
import type { User } from "@slock/types";
import { createDebouncedSearch } from "@slock/ui";
import { createEffect } from "solid-js";
import { queryToken } from "../querySuggestions";

const PEOPLE_MODIFIERS = new Set(["from", "with"]);
const SEARCH_DELAY_MS = 150;
type NamedEntity = { id: string; name: string };

export function stripNegation(token: string): string {
  return token.startsWith("-") ? token.slice(1) : token;
}

export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map(local.map((item): [string, T] => [item.id, item]));
  for (const item of remote) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
}

function currentToken(query: string, cursor: number): { modifier: string; term: string } {
  const raw = stripNegation(queryToken(query, cursor).value);
  const [modifier, term = ""] = raw.split(":", 2);
  return { modifier: defined(modifier), term };
}

export interface TokenEntitySearchDeps {
  query: () => string;
  cursor: () => number;
  searchUsers: (term: string) => Promise<User[]>;
  searchChannels: (term: string) => Promise<NamedEntity[]>;
}

export function createTokenEntitySearch(deps: TokenEntitySearchDeps) {
  const users = createDebouncedSearch({
    delay: SEARCH_DELAY_MS,
    empty: [],
    search: deps.searchUsers,
  });
  const channels = createDebouncedSearch({
    delay: SEARCH_DELAY_MS,
    empty: [],
    search: deps.searchChannels,
  });
  createEffect(
    () => currentToken(deps.query(), deps.cursor()),
    ({ modifier, term }) => {
      users.set(PEOPLE_MODIFIERS.has(modifier) ? term : "");
      channels.set(modifier === "in" ? term : "");
    },
  );

  return { remoteChannels: channels.value, remoteUsers: users.value };
}
