import type { User } from "@slock/types";
import { fuzzySearch } from "@slock/ui";
import type { Setter } from "solid-js";
import { fetchBrowsableChannels } from "../../../lib/api";
import { store } from "../../../lib/store";
import { slashCommandsGlobal } from "./commands/slashCommandSuggestions";
import { allEmojiEntries, frequentEmoji, searchEmoji } from "./emojiSearch";
import { stripLeadingAt } from "./quillMentions";
import type {
  ChannelSuggestItem,
  CommandSuggestItem,
  EmojiSuggestItem,
  SpecialMentionSuggestItem,
  SuggestState,
  TemplateSuggestItem,
  UsergroupSuggestItem,
  UserSuggestItem,
} from "./suggestTypes";

export type SuggestionOptions = {
  suggest: () => SuggestState | null;
  setSuggest: Setter<SuggestState | null>;
  applyTextSuggestion: (item: SuggestState["items"][number], state: SuggestState) => void;
  includeCommands?: boolean;
  lineCommands?: () => CommandSuggestItem[];
  includeBroadcastMentions?: boolean;

  channelId?: () => string | undefined;
};

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
    text: (g) => stripLeadingAt(g.name),
  })
    .slice(0, 8)
    .map((g) => ({ id: g.id, kind: "usergroup", name: stripLeadingAt(g.name) }));
}

function isChannelBroadcastManager(channelId: string | undefined): boolean {
  if (!channelId) return false;
  const me = store.users.currentUser();
  if (!me) return false;
  if (me.isWorkspaceAdmin) return true;
  return store.channels.channelManagerIds(channelId)?.has(me.id) ?? false;
}

type ChannelCandidate = { id: string; name: string; private: boolean };

export function createStaticSuggestion(
  kind: "command" | "emoji",
  start: number,
  query: string,
  lineCommands?: CommandSuggestItem[],
): SuggestState | null {
  if (kind === "command") {
    const ranked = fuzzySearch(lineCommands ?? slashCommandsGlobal(), {
      query,
      text: (c) => c.name,
    });
    const items = lineCommands ? ranked : ranked.slice(0, 8);
    return items.length > 0 ? { active: 0, items, kind, start } : null;
  }
  const entries = allEmojiEntries();
  const ranked = query ? searchEmoji(entries, query) : frequentEmoji();
  const items: EmojiSuggestItem[] = ranked
    .slice(0, 50)
    .map((e) => ({ kind: "emoji", name: e.name, unicode: e.unicode }));
  return items.length > 0 ? { active: 0, items, kind, start } : null;
}

export function templateSuggestion(start: number, query: string): SuggestState | null {
  const items: TemplateSuggestItem[] = fuzzySearch(store.composerTemplates.templates(), {
    query,
    text: (t) => t.name,
  })
    .slice(0, 8)
    .map((t) => ({ blocks: t.blocks, files: t.files, id: t.id, kind: "template", name: t.name }));
  return items.length > 0 ? { active: 0, items, kind: "template", start } : null;
}

export function updateUserSuggestions(
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
      const flag = (item: UserSuggestItem): UserSuggestItem => ({
        ...item,
        notInChannel: !resolved.has(item.id),
      });
      opts.setSuggest((prev) => {
        if (prev?.kind === "userlink" && trigger.kind === "userlink")
          return { ...prev, items: prev.items.map(flag) };
        if (prev?.kind === "user" && trigger.kind === "user")
          return {
            ...prev,
            items: prev.items.map((item) => (item.kind === "user" ? flag(item) : item)),
          };
        return prev;
      });
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

export function updateChannelSuggestions(
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
