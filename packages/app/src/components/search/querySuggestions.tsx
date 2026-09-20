import { Avatar, fuzzySearch, Icon } from "@slock/ui";
import type { User } from "../../lib/api";
import { store } from "../../lib/store";

export type QuerySuggestion = {
  id: string;
  label: string;
  replaceToken?: boolean;
  value: string;
  user?: User;
};

export type QuerySuggestionContext = {
  currentChannel?: { id: string; name: string };
  currentDmUser?: { id: string; name: string };
  currentUserId?: string;
};

const HAS_VALUES = ["link", "image", "file", "star", "pin", "reaction"];
const HASMY_VALUES = ["+1", "eyes", "heart", "white_check_mark"];
const IS_VALUES = ["thread", "saved"];
const TYPE_VALUES = ["image", "pdf", "doc", "spreadsheet", "video", "zip"];

const TOKEN_OR_PILL_BOUNDARY_RE = /[ ￼\n]/;

function tokenAt(value: string, cursor: number) {
  let start = 0;
  for (let i = Math.min(cursor - 1, value.length - 1); i >= 0; i--) {
    if (TOKEN_OR_PILL_BOUNDARY_RE.test(value[i])) {
      start = i + 1;
      break;
    }
  }
  let end = value.length;
  for (let i = cursor; i < value.length; i++) {
    if (TOKEN_OR_PILL_BOUNDARY_RE.test(value[i])) {
      end = i;
      break;
    }
  }
  return { end, start, value: value.slice(start, cursor) };
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function monthName(monthsAgo: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.toLocaleString("en-US", { month: "long" }).toLowerCase();
}

export function queryToken(value: string, cursor: number) {
  return tokenAt(value, cursor);
}

function withPrefix(prefix: string, suggestion: QuerySuggestion): QuerySuggestion {
  if (!prefix) return suggestion;
  return {
    ...suggestion,
    id: `${prefix}${suggestion.id}`,
    label: `${prefix}${suggestion.label}`,
    value: `${prefix}${suggestion.value}`,
  };
}

function staticValueSuggestions(
  modifier: string,
  term: string,
  values: string[],
  prefix: string,
  format: (value: string) => string = (v) => v,
): QuerySuggestion[] {
  return values
    .filter((value) => value.startsWith(term))
    .map((value) =>
      withPrefix(prefix, {
        id: `${modifier}-${value}`,
        label: `${modifier}:${format(value)}`,
        replaceToken: true,
        value: `${modifier}:${format(value)}`,
      }),
    );
}

function dateSuggestions(modifier: string, term: string, prefix: string): QuerySuggestion[] {
  return [dateOffset(0), dateOffset(1), dateOffset(7)]
    .filter((value) => !term || value.startsWith(term))
    .map((value) =>
      withPrefix(prefix, {
        id: `${modifier}-${value}`,
        label: `${modifier}:${value}`,
        replaceToken: true,
        value: `${modifier}:${value}`,
      }),
    );
}

function duringSuggestions(term: string, prefix: string): QuerySuggestion[] {
  return [monthName(0), monthName(1), String(new Date().getFullYear())]
    .filter((value) => !term || value.startsWith(term))
    .map((value) =>
      withPrefix(prefix, {
        id: `during-${value}`,
        label: `during:${value}`,
        replaceToken: true,
        value: `during:${value}`,
      }),
    );
}

function entitySuggestions<T extends { id: string; name: string }>(
  modifier: string,
  sigil: "@" | "#",
  term: string,
  items: T[],
  prefix: string,
  featured?: { id: string; name: string },
  avatarOf?: (item: T) => User,
): QuerySuggestion[] {
  const wrap = (id: string) => (sigil === "@" ? `<@${id}>` : `<#${id}>`);
  const build = (id: string, name: string, user?: User): QuerySuggestion => ({
    id: `${modifier}-${id}`,
    label: `${modifier}:${sigil}${name}`,
    replaceToken: true,
    user,
    value: `${modifier}:${wrap(id)}`,
  });
  const matches = fuzzySearch(items, {
    frequency: (item) => store.preferences.frecencyScore(item.id),
    query: term,
    text: (item) => item.name,
  })
    .filter((item) => item.id !== featured?.id)
    .slice(0, 6)
    .map((item) => withPrefix(prefix, build(item.id, item.name, avatarOf?.(item))));
  if (featured?.name.toLowerCase().startsWith(term)) {
    matches.unshift(withPrefix(prefix, build(featured.id, featured.name)));
  }
  return matches.slice(0, 7);
}

export function activeViewSuggestionContext(): QuerySuggestionContext {
  const view = store.viewState.activeView();
  const currentUserId = store.users.currentUser()?.id;
  if (view?.kind === "channel") {
    const channel = store.channels.channelById(view.id);
    return {
      currentChannel: channel ? { id: channel.id, name: channel.name } : undefined,
      currentUserId,
    };
  }
  if (view?.kind === "dm") {
    const userId = store.dms.dmById(view.id)?.userId;
    const user = userId ? store.users.userById(userId) : undefined;
    return { currentDmUser: user ? { id: user.id, name: user.name } : undefined, currentUserId };
  }
  return { currentUserId };
}

export function querySuggestions(
  query: string,
  cursor: number,
  users: User[],
  channels: { id: string; name: string }[],
  context: QuerySuggestionContext = {},
): QuerySuggestion[] {
  const rawToken = tokenAt(query, cursor).value;
  const negated = rawToken.startsWith("-");
  const prefix = negated ? "-" : "";
  const token = (negated ? rawToken.slice(1) : rawToken).toLowerCase();

  if (!token.includes(":")) return [];

  const [modifier, term = ""] = token.split(":", 2);
  switch (modifier) {
    case "from":
      return entitySuggestions(
        "from",
        "@",
        term,
        users,
        prefix,
        context.currentUserId ? { id: context.currentUserId, name: "me" } : undefined,
        (user) => user,
      );
    case "with":
      return entitySuggestions(
        "with",
        "@",
        term,
        users,
        prefix,
        context.currentDmUser,
        (user) => user,
      );
    case "in":
      return entitySuggestions("in", "#", term, channels, prefix, context.currentChannel);
    case "has":
      return staticValueSuggestions("has", term, HAS_VALUES, prefix);
    case "hasmy":
      return staticValueSuggestions("hasmy", term, HASMY_VALUES, prefix, (v) => `:${v}:`);
    case "is":
      return staticValueSuggestions("is", term, IS_VALUES, prefix);
    case "type":
      return staticValueSuggestions("type", term, TYPE_VALUES, prefix);
    case "during":
      return duringSuggestions(term, prefix);
    case "after":
    case "before":
      return dateSuggestions(modifier, term, prefix);
    default:
      return [];
  }
}

export function renderQuerySuggestion(suggestion: QuerySuggestion) {
  if (suggestion.user) {
    return (
      <>
        <Avatar size="small" user={suggestion.user} />
        <span class="suggestion-label">{suggestion.label}</span>
      </>
    );
  }
  return (
    <>
      <Icon
        class="suggestion-icon flex-center"
        name={suggestion.replaceToken ? "filters" : "search"}
        size={13}
      />
      <span class="suggestion-label">{suggestion.label}</span>
    </>
  );
}
