import { fuzzySearch } from "@slock/ui";
import type { Channel, User } from "../../lib/api";

export type QuerySuggestion = {
  description?: string;
  id: string;
  label: string;
  replaceToken?: boolean;
  value: string;
};

export type QuerySuggestionContext = {
  currentChannel?: { id: string; name: string };
  currentDmUser?: { id: string; name: string };
  currentUserId?: string;
};

const MODIFIERS: { description: string; id: string }[] = [
  { description: "messages from a person", id: "from" },
  { description: "DMs with a person", id: "with" },
  { description: "messages in a conversation", id: "in" },
  { description: "messages with something", id: "has" },
  { description: "messages with your reaction", id: "hasmy" },
  { description: "message status", id: "is" },
  { description: "messages during a period", id: "during" },
  { description: "messages after a date", id: "after" },
  { description: "messages before a date", id: "before" },
  { description: "message or file type", id: "type" },
];

const HAS_VALUES = ["link", "image", "file", "star", "pin", "reaction"];
const HASMY_VALUES = ["+1", "eyes", "heart", "white_check_mark"];
const IS_VALUES = ["thread", "saved"];
const TYPE_VALUES = ["image", "pdf", "doc", "spreadsheet", "video", "zip"];

function tokenAt(value: string, cursor: number) {
  const start = value.lastIndexOf(" ", Math.max(0, cursor - 1)) + 1;
  const nextSpace = value.indexOf(" ", cursor);
  return {
    end: nextSpace === -1 ? value.length : nextSpace,
    start,
    value: value.slice(start, cursor),
  };
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

function modifierSuggestions(term: string, prefix: string): QuerySuggestion[] {
  return fuzzySearch(MODIFIERS, { query: term, text: (m) => m.id })
    .slice(0, 6)
    .map((m) =>
      withPrefix(prefix, {
        description: m.description,
        id: m.id,
        label: `${m.id}:`,
        replaceToken: true,
        value: `${m.id}:`,
      }),
    );
}

function staticValueSuggestions(
  modifier: string,
  term: string,
  values: string[],
  description: string,
  prefix: string,
  format: (value: string) => string = (v) => v,
): QuerySuggestion[] {
  return values
    .filter((value) => value.startsWith(term))
    .map((value) =>
      withPrefix(prefix, {
        description,
        id: `${modifier}-${value}`,
        label: `${modifier}:${format(value)}`,
        replaceToken: true,
        value: `${modifier}:${format(value)}`,
      }),
    );
}

function dateSuggestions(modifier: string, term: string, prefix: string): QuerySuggestion[] {
  return [
    { label: "today", value: dateOffset(0) },
    { label: "yesterday", value: dateOffset(1) },
    { label: "a week ago", value: dateOffset(7) },
  ]
    .filter((item) => !term || item.value.startsWith(term))
    .map((item) =>
      withPrefix(prefix, {
        description: item.label,
        id: `${modifier}-${item.value}`,
        label: `${modifier}:${item.value}`,
        replaceToken: true,
        value: `${modifier}:${item.value}`,
      }),
    );
}

function duringSuggestions(term: string, prefix: string): QuerySuggestion[] {
  return [
    { label: "this month", value: monthName(0) },
    { label: "last month", value: monthName(1) },
    { label: "this year", value: String(new Date().getFullYear()) },
  ]
    .filter((item) => !term || item.value.startsWith(term))
    .map((item) =>
      withPrefix(prefix, {
        description: item.label,
        id: `during-${item.value}`,
        label: `during:${item.value}`,
        replaceToken: true,
        value: `during:${item.value}`,
      }),
    );
}

function entitySuggestions<T extends { id: string; name: string }>(
  modifier: string,
  sigil: "@" | "#",
  term: string,
  items: T[],
  prefix: string,
  description: string,
  featured?: { description: string; id: string; name: string },
): QuerySuggestion[] {
  const wrap = (id: string) => (sigil === "@" ? `<@${id}>` : `<#${id}>`);
  const build = (id: string, name: string, itemDescription: string): QuerySuggestion => ({
    description: itemDescription,
    id: `${modifier}-${id}`,
    label: `${modifier}:${sigil}${name}`,
    replaceToken: true,
    value: `${modifier}:${wrap(id)}`,
  });
  const matches = fuzzySearch(items, { query: term, text: (item) => item.name })
    .filter((item) => item.id !== featured?.id)
    .slice(0, 6)
    .map((item) => withPrefix(prefix, build(item.id, item.name, description)));
  if (featured?.name.toLowerCase().startsWith(term)) {
    matches.unshift(withPrefix(prefix, build(featured.id, featured.name, featured.description)));
  }
  return matches.slice(0, 7);
}

export function querySuggestions(
  query: string,
  cursor: number,
  users: User[],
  channels: Channel[],
  context: QuerySuggestionContext = {},
): QuerySuggestion[] {
  const rawToken = tokenAt(query, cursor).value;
  const negated = rawToken.startsWith("-");
  const prefix = negated ? "-" : "";
  const token = (negated ? rawToken.slice(1) : rawToken).toLowerCase();

  if (!token.includes(":")) return modifierSuggestions(token, prefix);

  const [modifier, term = ""] = token.split(":", 2);
  switch (modifier) {
    case "from":
      return entitySuggestions(
        "from",
        "@",
        term,
        users,
        prefix,
        "person",
        context.currentUserId
          ? { description: "you", id: context.currentUserId, name: "me" }
          : undefined,
      );
    case "with":
      return entitySuggestions(
        "with",
        "@",
        term,
        users,
        prefix,
        "person",
        context.currentDmUser
          ? {
              description: "this conversation",
              id: context.currentDmUser.id,
              name: context.currentDmUser.name,
            }
          : undefined,
      );
    case "in":
      return entitySuggestions(
        "in",
        "#",
        term,
        channels,
        prefix,
        "channel",
        context.currentChannel
          ? {
              description: "this channel",
              id: context.currentChannel.id,
              name: context.currentChannel.name,
            }
          : undefined,
      );
    case "has":
      return staticValueSuggestions("has", term, HAS_VALUES, "message property", prefix);
    case "hasmy":
      return staticValueSuggestions(
        "hasmy",
        term,
        HASMY_VALUES,
        "message with your reaction",
        prefix,
        (v) => `:${v}:`,
      );
    case "is":
      return staticValueSuggestions("is", term, IS_VALUES, "message status", prefix);
    case "type":
      return staticValueSuggestions("type", term, TYPE_VALUES, "file type", prefix);
    case "during":
      return duringSuggestions(term, prefix);
    case "after":
    case "before":
      return dateSuggestions(modifier, term, prefix);
    default:
      return [];
  }
}
