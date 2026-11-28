import { createTypeahead } from "@slock/plugins/query/client/api";
import { channelMatches } from "@slock/plugins/slack/client/api";
import { userMatches } from "@slock/plugins/users/client/api";
import { createEffect } from "solid-js";
import { partialToken } from "./queryToken";

const PEOPLE_MODIFIERS = new Set(["creator", "from", "with"]);
const SEARCH_DELAY_MS = 150;

export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map(local.map((item): [string, T] => [item.id, item]));
  for (const item of remote) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
}

export function createTokenEntitySearch(deps: { text: () => string; cursor: () => number }) {
  const options = { arg: (term: string) => term, delay: SEARCH_DELAY_MS, empty: [] };
  const users = createTypeahead(userMatches, options);
  const channels = createTypeahead(channelMatches, options);
  createEffect(
    () => partialToken(deps.text(), deps.cursor()),
    (token) => {
      const inPerson = token?.modifier === "in" && token.sigil === "@";
      const people = !!token && (inPerson || PEOPLE_MODIFIERS.has(token.modifier));
      users.set(token && people ? token.term : "");
      channels.set(token?.modifier === "in" && !inPerson ? token.term : "");
    },
  );

  return { remoteChannels: channels.value, remoteUsers: users.value };
}
