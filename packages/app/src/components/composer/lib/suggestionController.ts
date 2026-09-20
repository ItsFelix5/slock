import { loadCustomEmoji } from "@slock/blockkit";
import { fuzzySearch, listNavigationIndex } from "@slock/ui";
import type { Setter } from "solid-js";
import type { User } from "../../../lib/api";
import { fetchBrowsableChannels } from "../../../lib/api";
import { store } from "../../../lib/store";
import {
  loadSlashCommandSuggestions,
  slashCommandsGlobal,
} from "./commands/slashCommandSuggestions";
import { allEmojiEntries, frequentEmoji, searchEmoji } from "./emojiSearch";
import type {
  ChannelSuggestItem,
  EmojiSuggestItem,
  SpecialMentionSuggestItem,
  SuggestState,
  UsergroupSuggestItem,
  UserSuggestItem,
} from "./suggestTypes";
import { detectMentionTrigger } from "./textDetection";

type SuggestionOptions = {
  suggest: () => SuggestState | null;
  setSuggest: Setter<SuggestState | null>;
  applyTextSuggestion: (item: SuggestState["items"][number], state: SuggestState) => void;
  includeCommands?: boolean;
  includeBroadcastMentions?: boolean;

  channelId?: () => string | undefined;
};

export function suggestionText(item: SuggestState["items"][number]): string {
  if (item.kind === "command") return `/${item.name} `;
  if (item.kind === "emoji") return `:${item.name}: `;
  if (item.kind === "user") return `<@${item.id}> `;
  return `<#${item.id}|${item.name}> `;
}

const LEADING_AT_RE = /^@/;

const SPECIAL_MENTIONS: Omit<SpecialMentionSuggestItem, "kind">[] = [
  { description: "Notify everyone in this channel", id: "channel", name: "channel" },
  { description: "Notify online people in this channel", id: "here", name: "here" },
];

function specialMentionItems(
  triggerKind: "user" | "userlink",
  query: string,
  canBroadcast: boolean,
): SpecialMentionSuggestItem[] {
  if (triggerKind !== "user" || !canBroadcast) return [];
  return SPECIAL_MENTIONS.filter((m) => m.id.startsWith(query)).map(
    (m): SpecialMentionSuggestItem => ({ ...m, kind: "special" }),
  );
}

function usergroupItems(triggerKind: "user" | "userlink", query: string): UsergroupSuggestItem[] {
  if (triggerKind !== "user") return [];
  return fuzzySearch(store.usergroups.mentionableUsergroups(), {
    query,
    text: (g) => g.name.replace(LEADING_AT_RE, ""),
  })
    .slice(0, 8)
    .map((g) => ({ id: g.id, kind: "usergroup", name: g.name.replace(LEADING_AT_RE, "") }));
}

function isChannelBroadcastManager(channelId: string | undefined): boolean {
  if (!channelId) return false;
  const me = store.users.currentUser();
  if (!me) return false;
  if (me.isWorkspaceAdmin) return true;
  return store.channels.channelManagerIds(channelId)?.has(me.id) ?? false;
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
    }).slice(0, 8);
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
  const roster = channelId ? store.channels.channelRosterIds(channelId) : undefined;
  const managerIds = channelId ? store.channels.channelManagerIds(channelId) : undefined;
  const canBroadcast = (id: string | undefined) =>
    opts.includeBroadcastMentions !== false && isChannelBroadcastManager(id);
  const specials = specialMentionItems(trigger.kind, query, canBroadcast(channelId));
  const groups = usergroupItems(trigger.kind, query);
  const toItems = (
    users: User[],
  ): (UserSuggestItem | SpecialMentionSuggestItem | UsergroupSuggestItem)[] => [
    ...specials,
    ...groups,
    ...fuzzySearch(users, {
      frequency: (u) => store.preferences.frecencyScore(u.id),
      query,
      text: (u) => u.name,
    })
      .slice(0, 8)
      .map(
        (u): UserSuggestItem => ({
          id: u.id,
          kind: "user",
          name: u.name,
          notInChannel: roster ? !roster.has(u.id) : false,
          user: u,
        }),
      ),
  ];
  const localUsers = store.users.knownUsers().filter((u) => u.id !== me);
  const buildState = (
    items: (UserSuggestItem | SpecialMentionSuggestItem | UsergroupSuggestItem)[],
  ): SuggestState =>
    trigger.kind === "user"
      ? { active: 0, items, kind: "user", start: trigger.start }
      : {
          active: 0,
          items: items.filter((item): item is UserSuggestItem => item.kind === "user"),
          kind: "userlink",
          start: trigger.start,
        };
  opts.setSuggest(buildState(toItems(localUsers)));
  if (channelId && !roster) {
    store.channels.ensureChannelRoster(channelId).then((resolved) => {
      if (requestId !== currentRequestId() || !resolved) return;
      opts.setSuggest((prev) =>
        prev?.kind === trigger.kind
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.kind === "user" ? { ...item, notInChannel: !resolved.has(item.id) } : item,
              ),
            }
          : prev,
      );
    });
  }
  if (channelId && !managerIds && trigger.kind === "user") {
    store.channels.ensureChannelManagers(channelId).then(() => {
      if (requestId !== currentRequestId()) return;
      opts.setSuggest((prev) => {
        if (prev?.kind !== "user") return prev;
        const items = prev.items.filter((item) => item.kind !== "special");
        return {
          ...prev,
          items: [...specialMentionItems("user", query, canBroadcast(channelId)), ...items],
        };
      });
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
        prev?.kind === trigger.kind ? buildState(toItems([...merged.values()])) : prev,
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
        { kind: trigger.kind, start: trigger.start },
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
