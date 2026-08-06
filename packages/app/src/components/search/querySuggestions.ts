import type { Channel, User } from "@slock/slack-api";
import { fuzzySearch } from "@slock/ui";

export type QuerySuggestion = {
  description?: string;
  id: string;
  label: string;
  replaceToken?: boolean;
  value: string;
};

const modifiers: QuerySuggestion[] = [
  {
    description: "messages from a person",
    id: "from",
    label: "from:",
    replaceToken: true,
    value: "from:",
  },
  {
    description: "messages in a conversation",
    id: "in",
    label: "in:",
    replaceToken: true,
    value: "in:",
  },
  {
    description: "messages with something",
    id: "has",
    label: "has:",
    replaceToken: true,
    value: "has:",
  },
  {
    description: "messages after a date",
    id: "after",
    label: "after:",
    replaceToken: true,
    value: "after:",
  },
  {
    description: "messages before a date",
    id: "before",
    label: "before:",
    replaceToken: true,
    value: "before:",
  },
  { description: "message status", id: "is", label: "is:", replaceToken: true, value: "is:" },
];

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

export function queryToken(value: string, cursor: number) {
  return tokenAt(value, cursor);
}

export function querySuggestions(
  query: string,
  cursor: number,
  users: User[],
  channels: Channel[],
): QuerySuggestion[] {
  const token = tokenAt(query, cursor).value.toLowerCase();
  if (!token.includes(":")) {
    return fuzzySearch(modifiers, { query: token, text: (item) => item.label }).slice(0, 6);
  }
  const [modifier, term = ""] = token.split(":", 2);
  if (modifier === "from") {
    return fuzzySearch(users, { query: term, text: (user) => user.name })
      .slice(0, 7)
      .map((user) => ({
        description: "person",
        id: `from-${user.id}`,
        label: `@${user.name}`,
        replaceToken: true,
        value: `from:<@${user.id}>`,
      }));
  }
  if (modifier === "in") {
    return fuzzySearch(channels, { query: term, text: (channel) => channel.name })
      .slice(0, 7)
      .map((channel) => ({
        description: "channel",
        id: `in-${channel.id}`,
        label: `#${channel.name}`,
        replaceToken: true,
        value: `in:<#${channel.id}>`,
      }));
  }
  if (modifier === "has") {
    return ["link", "star", "pin", "reaction"]
      .filter((value) => value.startsWith(term))
      .map((value) => ({
        description: "message property",
        id: `has-${value}`,
        label: `has:${value}`,
        replaceToken: true,
        value: `has:${value}`,
      }));
  }
  if (modifier === "is") {
    return ["thread", "saved"]
      .filter((value) => value.startsWith(term))
      .map((value) => ({
        description: "message status",
        id: `is-${value}`,
        label: `is:${value}`,
        replaceToken: true,
        value: `is:${value}`,
      }));
  }
  if (modifier === "after" || modifier === "before") {
    return [
      { label: "today", value: dateOffset(0) },
      { label: "yesterday", value: dateOffset(1) },
      { label: "a week ago", value: dateOffset(7) },
    ]
      .filter((item) => !term || item.value.startsWith(term))
      .map((item) => ({
        description: item.label,
        id: `${modifier}-${item.value}`,
        label: `${modifier}:${item.value}`,
        replaceToken: true,
        value: `${modifier}:${item.value}`,
      }));
  }
  return [];
}
