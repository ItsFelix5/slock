import type { User } from "@slock/types";
import { createDebouncedRequest } from "@slock/ui";
import { createEffect, createSignal } from "solid-js";
import { queryToken } from "../querySuggestions";

const PEOPLE_MODIFIERS = new Set(["from", "with"]);
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
  return { modifier, term };
}

export interface TokenEntitySearchDeps {
  query: () => string;
  cursor: () => number;
  searchUsers: (term: string) => Promise<User[]>;
  searchChannels: (term: string) => Promise<NamedEntity[]>;
}

export function createTokenEntitySearch(deps: TokenEntitySearchDeps) {
  const [remoteUsers, setRemoteUsers] = createSignal<User[]>([]);
  const [remoteChannels, setRemoteChannels] = createSignal<NamedEntity[]>([]);

  const peopleRequest = createDebouncedRequest(deps.searchUsers, {
    delay: 150,
    onReset: () => setRemoteUsers([]),
    onResult: setRemoteUsers,
  });
  const channelRequest = createDebouncedRequest(deps.searchChannels, {
    delay: 150,
    onReset: () => setRemoteChannels([]),
    onResult: setRemoteChannels,
  });
  createEffect(() => {
    const { modifier, term } = currentToken(deps.query(), deps.cursor());
    peopleRequest.run(PEOPLE_MODIFIERS.has(modifier) ? term : "");
    channelRequest.run(modifier === "in" ? term : "");
  });

  return { remoteChannels, remoteUsers };
}
