import { startOfDay, toLocalInputValue } from "@slock/core";
import { service } from "@slock/core/solid";
import type { User } from "@slock/types";
import { Avatar, fuzzySearch, Icon } from "@slock/ui";
import { partialToken } from "./lib/queryToken";

const viewStore = service("conversations");
const dmsStore = service("dms");
const channelsStore = service("channels");
const usersStore = service("users");
const prefsStore = service("prefs");
const env = service("env");

export interface QuerySuggestion {
  id: string;
  label: string;
  user?: User;
  value: string;
}

interface Named {
  id: string;
  name: string;
}

interface QuerySuggestionContext {
  currentChannel?: Named;
  currentDmUser?: User;
  currentUser?: User;
  modifiers?: readonly string[];
}

const EMOJI_VALUES = [":+1:", ":eyes:", ":heart:", ":white_check_mark:"];

const STATIC_VALUES: Record<string, readonly string[]> = {
  has: ["link", "file", "reaction", "pin", "action", "star", ...EMOJI_VALUES],
  hasmy: EMOJI_VALUES,
  is: ["thread", "dm", "saved", "todos"],
  type: [
    "images",
    "pdfs",
    "documents",
    "spreadsheets",
    "presentations",
    "snippets",
    "emails",
    "audio",
    "videos",
    "canvases",
    "lists",
    "huddle_notes",
    "zips",
    "gdocs",
  ],
};

const ENTITY_LIMIT = 6;
const LEADING_COLON_RE = /^:/;

function dateOffset(days: number) {
  return toLocalInputValue(startOfDay(env.now(), -days), "date");
}

function monthName(monthsAgo: number) {
  const now = new Date(env.now());
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
    .toLocaleString("en-US", { month: "long" })
    .toLowerCase();
}

function dateValues(modifier: string): readonly string[] | undefined {
  if (modifier === "during") {
    const year = String(new Date(env.now()).getFullYear());
    return ["today", "yesterday", "week", monthName(0), monthName(1), year];
  }
  const dated = ["after", "before", "on"].includes(modifier);
  return dated ? [0, 1, 7].map(dateOffset) : undefined;
}

function entitySuggestions<T extends Named>(
  sigil: "@" | "#",
  term: string,
  items: T[],
  build: (shown: string, value: string, user?: User) => QuerySuggestion,
  featured?: T,
  avatarOf?: (item: T) => User,
): QuerySuggestion[] {
  const pinned = featured?.name.toLowerCase().startsWith(term) ? featured : undefined;
  const matches = fuzzySearch(items, {
    frequency: (item) => prefsStore.frecencyScore(item.id),
    query: term,
    text: (item) => item.name,
  })
    .filter((item) => item.id !== pinned?.id)
    .slice(0, ENTITY_LIMIT);
  return (pinned ? [pinned, ...matches] : matches).map((item) =>
    build(`${sigil}${item.name}`, `<${sigil}${item.id}>`, avatarOf?.(item)),
  );
}

export function activeViewSuggestionContext(): QuerySuggestionContext {
  const view = viewStore.activeView();
  const currentUser = usersStore.currentUser();
  if (view?.kind === "channel") {
    return { currentChannel: channelsStore.channelById(view.id), currentUser };
  }
  if (view?.kind === "dm") {
    const userId = dmsStore.dmById(view.id)?.userId;
    return {
      currentDmUser: userId ? usersStore.userById(userId) : undefined,
      currentUser,
    };
  }
  return { currentUser };
}

export function querySuggestions(
  text: string,
  cursor: number,
  users: User[],
  channels: Named[],
  context: QuerySuggestionContext = {},
): QuerySuggestion[] {
  const token = partialToken(text, cursor);
  if (!token) return [];
  const { modifier, prefix, raw, sigil, term } = token;
  if (context.modifiers && !context.modifiers.includes(modifier)) return [];

  const build = (shown: string, value = shown, user?: User): QuerySuggestion => ({
    id: `${prefix}${modifier}-${value}`,
    label: `${prefix}${modifier}:${shown}`,
    user,
    value: `${prefix}${modifier}:${value}`,
  });
  const people = (featured?: User) =>
    entitySuggestions("@", term, users, build, featured, (user) => user);

  function matches(): QuerySuggestion[] {
    switch (modifier) {
      case "from":
      case "creator": {
        const me = context.currentUser;
        return people(me && { ...me, name: "me" });
      }
      case "with":
        return people(context.currentDmUser);
      case "in":
        if (sigil === "@") return people(context.currentDmUser);
        return entitySuggestions("#", term, channels, build, context.currentChannel);
      default: {
        const values = dateValues(modifier) ?? STATIC_VALUES[modifier] ?? [];
        return values
          .filter((value) => value.replace(LEADING_COLON_RE, "").startsWith(term))
          .map((value) => build(value));
      }
    }
  }

  const found = matches();
  const complete = found.some(({ value }) => value.toLowerCase() === raw.toLowerCase());
  return complete ? [] : found;
}

export function renderQuerySuggestion(suggestion: QuerySuggestion) {
  return (
    <>
      {suggestion.user ? (
        <Avatar size="small" user={suggestion.user} />
      ) : (
        <Icon class="suggestion-icon flex-center" name="filters" size={13} />
      )}
      <span class="suggestion-label">{suggestion.label}</span>
    </>
  );
}
