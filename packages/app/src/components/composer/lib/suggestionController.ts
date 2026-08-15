import { loadCustomEmoji } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { fuzzySearch, listNavigationIndex } from "@slock/ui";
import type { Setter } from "solid-js";
import { allEmojiEntries, frequentEmoji, searchEmoji } from "../../../lib/emojiSearch";
import { store } from "../../../lib/store";
import {
  loadSlashCommandSuggestions,
  slashCommandsGlobal,
} from "./commands/slashCommandSuggestions";
import type {
  ChannelSuggestItem,
  CommandSuggestItem,
  EmojiSuggestItem,
  SuggestState,
  UserSuggestItem,
} from "./suggestTypes";
import { detectMentionTrigger } from "./textDetection";

type SuggestionOptions = {
  suggest: () => SuggestState | null;
  setSuggest: Setter<SuggestState | null>;
  applyTextSuggestion: (item: SuggestState["items"][number], state: SuggestState) => void;
  includeCommands?: boolean;

  channelId?: () => string | undefined;
};

export function suggestionText(
  item: SuggestState["items"][number],
  kind: SuggestState["kind"],
): string {
  if (item.kind === "command") return `/${item.name} `;
  if (item.kind === "emoji") return `:${item.name}: `;
  if (kind === "userlink") return `@${item.name} `;
  if (item.kind === "user") return `<@${item.id}> `;
  return `<#${item.id}|${item.name}> `;
}

type ChannelCandidate = { id: string; name: string; private: boolean };

function createStaticSuggestion(
  kind: "command" | "emoji",
  start: number,
  query: string,
): SuggestState | null {
  if (kind === "command") {
    const items = fuzzySearch(slashCommandsGlobal(), {
      query,
      text: (c) => c.name,
    }).map(
      (c): CommandSuggestItem => ({
        desc: c.desc,
        icon: c.icon,
        kind: "command",
        name: c.name,
      }),
    );
    return items.length > 0 ? { active: 0, items, kind, start } : null;
  }
  const entries = allEmojiEntries();
  const ranked = query ? searchEmoji(entries, query) : frequentEmoji(entries);
  const items: EmojiSuggestItem[] = ranked
    .slice(0, 50)
    .map((e) => ({ kind: "emoji", name: e.name, unicode: e.unicode }));
  return items.length > 0 ? { active: 0, items, kind, start } : null;
}

function updateUserSuggestions(
  opts: SuggestionOptions,
  trigger: { kind: "user" | "userlink"; start: number },
  query: string,
  requestId: number,
  currentRequestId: () => number,
) {
  const me = store.users.currentUser()?.id;
  const channelId = trigger.kind === "user" ? opts.channelId?.() : undefined;
  const roster = channelId ? store.channels.channelMemberIds(channelId) : undefined;
  const toItems = (users: User[]): UserSuggestItem[] =>
    fuzzySearch(users, {
      frequency: (u) => store.preferences.frecencyScore(u.id),
      query,
      text: (u) => u.name,
    })
      .slice(0, 8)
      .map((u) => ({
        id: u.id,
        kind: "user",
        name: u.name,
        notInChannel: roster ? !roster.has(u.id) : false,
        user: u,
      }));
  const localUsers = store.users.knownUsers().filter((u) => u.id !== me);
  opts.setSuggest({
    active: 0,
    items: toItems(localUsers),
    kind: trigger.kind,
    start: trigger.start,
  });
  if (channelId && !roster) {
    store.channels.ensureChannelRoster(channelId).then((resolved) => {
      if (requestId !== currentRequestId() || !resolved) return;
      opts.setSuggest((prev) =>
        prev?.kind === trigger.kind
          ? {
              ...prev,
              items: prev.items.map((item) => ({
                ...item,
                notInChannel: !resolved.has(item.id),
              })),
            }
          : prev,
      );
    });
  }
  if (!query) return;
  store.users
    .searchUsers(query, me)
    .then((found) => {
      if (requestId !== currentRequestId()) return;
      const merged = new Map<string, User>(localUsers.map((u) => [u.id, u]));
      for (const user of found) merged.set(user.id, user);
      opts.setSuggest((prev) =>
        prev?.kind === trigger.kind ? { ...prev, items: toItems([...merged.values()]) } : prev,
      );
    })
    .catch(() => {});
}

function updateChannelSuggestions(
  opts: SuggestionOptions,
  start: number,
  query: string,
  requestId: number,
  currentRequestId: () => number,
) {
  const toItems = (list: ChannelCandidate[]): ChannelSuggestItem[] =>
    fuzzySearch(list, {
      frequency: (c) => store.preferences.frecencyScore(c.id),
      query,
      text: (c) => c.name,
    })
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        kind: "channel",
        name: c.name,
        notInChannel: !store.channels.isChannelMember(c.id),
        private: c.private,
      }));
  const localChannels = store.channels.channels();
  opts.setSuggest({
    active: 0,
    items: toItems(localChannels),
    kind: "channel",
    start,
  });
  if (!query) return;
  fetchBrowsableChannels(query)
    .then((found) => {
      if (requestId !== currentRequestId()) return;
      const merged = new Map<string, ChannelCandidate>(localChannels.map((c) => [c.id, c]));
      for (const channel of found) merged.set(channel.id, channel);
      opts.setSuggest((prev) =>
        prev?.kind === "channel" ? { ...prev, items: toItems([...merged.values()]) } : prev,
      );
    })
    .catch(() => {});
}

export function createSuggestionController(opts: SuggestionOptions) {
  let suggestRequestId = 0;

  function setActiveSuggestion(index: number) {
    opts.setSuggest((prev) => (prev ? { ...prev, active: index } : prev));
  }

  function moveActiveSuggestion(delta: number) {
    const s = opts.suggest();
    if (!s) return;
    const next = listNavigationIndex(
      delta > 0 ? "ArrowDown" : "ArrowUp",
      s.active,
      s.items.length,
      {
        wrap: true,
      },
    );
    if (next !== undefined) setActiveSuggestion(next);
  }

  function updateSuggestions(value: string, cursor: number, isDocStart = true) {
    const trigger = detectMentionTrigger(value, cursor);
    if (!trigger) {
      opts.setSuggest(null);
      return;
    }
    // a slash command only counts at the very start of the message - "/" typed at the start of
    // a later paragraph is just a literal slash, not a command trigger
    if (trigger.kind === "command" && (opts.includeCommands === false || !isDocStart)) {
      opts.setSuggest(null);
      return;
    }
    const q = trigger.query.toLowerCase();
    const reqId = ++suggestRequestId;
    if (trigger.kind === "command" || trigger.kind === "emoji") {
      if (trigger.kind === "command") void loadSlashCommandSuggestions();
      if (trigger.kind === "emoji") void loadCustomEmoji();
      opts.setSuggest(createStaticSuggestion(trigger.kind, trigger.start, q));
      return;
    }
    if (trigger.kind === "user" || trigger.kind === "userlink") {
      updateUserSuggestions(
        opts,
        { kind: trigger.kind as "user" | "userlink", start: trigger.start },
        q,
        reqId,
        () => suggestRequestId,
      );
      return;
    }
    updateChannelSuggestions(opts, trigger.start, q, reqId, () => suggestRequestId);
  }

  function applySuggestion(index?: number) {
    const s = opts.suggest();
    if (!s) return;
    const item = s.items[index ?? s.active];
    if (!item) return;
    opts.applyTextSuggestion(item, s);
    opts.setSuggest(null);
  }

  return {
    applySuggestion,
    moveActiveSuggestion,
    setActiveSuggestion,
    updateSuggestions,
  };
}
