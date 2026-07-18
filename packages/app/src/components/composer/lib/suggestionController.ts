import { emojiUrl, loadCustomEmoji } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { fuzzySearch } from "@slock/ui";
import type { Setter } from "solid-js";
import { allEmojiEntries, frequentEmoji, searchEmoji } from "../../../lib/emojiSearch";
import { store } from "../../../lib/store";
import { slashCommandsGlobal } from "./drafts";
import {
  createChannelChip,
  createEmojiChip,
  createMentionChip,
  createUserLinkChip,
  placeCaretInText,
} from "./richtext";
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
  currentTextContext: () => { node: Text; offset: number } | null;
  syncFromDom: () => void;
};

type ChannelCandidate = { id: string; name: string; private: boolean };

function createStaticSuggestion(
  kind: "command" | "emoji",
  start: number,
  query: string,
): SuggestState | null {
  if (kind === "command") {
    const items = fuzzySearch(slashCommandsGlobal(), { query, text: (c) => c.name }).map(
      (c): CommandSuggestItem => ({ desc: c.desc, icon: c.icon, kind: "command", name: c.name }),
    );
    return items.length > 0 ? { active: 0, items, kind, start } : null;
  }
  const entries = allEmojiEntries();
  const ranked = query ? searchEmoji(entries, query) : frequentEmoji(entries);
  const items: EmojiSuggestItem[] = ranked
    .slice(0, 8)
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
  const toItems = (users: User[]): UserSuggestItem[] =>
    fuzzySearch(users, {
      frequency: (u) => store.preferences.frecencyScore(u.id),
      query,
      text: (u) => u.name,
    })
      .slice(0, 8)
      .map((u) => ({ id: u.id, kind: "user", name: u.name, user: u }));
  const localUsers = store.users.knownUsers().filter((u) => u.id !== me);
  opts.setSuggest({
    active: 0,
    items: toItems(localUsers),
    kind: trigger.kind,
    start: trigger.start,
  });
  if (!query) return;
  store.users.searchUsers(query, me).then((found) => {
    if (requestId !== currentRequestId()) return;
    const merged = new Map<string, User>(localUsers.map((u) => [u.id, u]));
    for (const user of found) merged.set(user.id, user);
    opts.setSuggest((prev) =>
      prev?.kind === trigger.kind ? { ...prev, items: toItems([...merged.values()]) } : prev,
    );
  });
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
      .map((c) => ({ id: c.id, kind: "channel", name: c.name, private: c.private }));
  const localChannels = store.channels.channels();
  opts.setSuggest({ active: 0, items: toItems(localChannels), kind: "channel", start });
  if (!query) return;
  fetchBrowsableChannels(query).then((found) => {
    if (requestId !== currentRequestId()) return;
    const merged = new Map<string, ChannelCandidate>(localChannels.map((c) => [c.id, c]));
    for (const channel of found) merged.set(channel.id, channel);
    opts.setSuggest((prev) =>
      prev?.kind === "channel" ? { ...prev, items: toItems([...merged.values()]) } : prev,
    );
  });
}

function insertSuggestionItem(
  item: SuggestState["items"][number],
  kind: SuggestState["kind"],
  parent: Node,
  after: Node,
) {
  if (item.kind === "command") {
    const insertion = document.createTextNode(`/${item.name} `);
    parent.insertBefore(insertion, after);
    placeCaretInText(insertion, insertion.length);
    return;
  }
  if (item.kind === "emoji") {
    const chip = emojiUrl(item.name) ? createEmojiChip(item.name) : null;
    if (chip) parent.insertBefore(chip, after);
    const insertion = chip
      ? document.createTextNode(" ")
      : document.createTextNode(`${item.unicode ?? `:${item.name}:`} `);
    parent.insertBefore(insertion, after);
    placeCaretInText(insertion, insertion.length);
    return;
  }
  const chip =
    kind === "userlink"
      ? createUserLinkChip(item.id, item.name)
      : item.kind === "user"
        ? createMentionChip(item.id, item.name)
        : createChannelChip(item.id, item.name);
  parent.insertBefore(chip, after);
  const space = document.createTextNode(" ");
  parent.insertBefore(space, after);
  placeCaretInText(space, 1);
}

// Drives the @mention / #channel / :emoji: / slash-command popover: matching
// the in-progress trigger to ranked candidates, keyboard/mouse selection
// within the list, and splicing the chosen item into the DOM at the caret.
export function createSuggestionController(opts: SuggestionOptions) {
  let suggestRequestId = 0;

  function setActiveSuggestion(index: number) {
    opts.setSuggest((prev) => (prev ? { ...prev, active: index } : prev));
  }

  function moveActiveSuggestion(delta: number) {
    const s = opts.suggest();
    if (!s) return;
    const n = s.items.length;
    setActiveSuggestion((((s.active + delta) % n) + n) % n);
  }

  function updateSuggestions(value: string, cursor: number) {
    const trigger = detectMentionTrigger(value, cursor);
    if (!trigger) {
      opts.setSuggest(null);
      return;
    }
    const q = trigger.query.toLowerCase();
    const reqId = ++suggestRequestId;
    if (trigger.kind === "command" || trigger.kind === "emoji") {
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
    const ctx = opts.currentTextContext();
    if (!(s && ctx)) return;
    const item = s.items[index ?? s.active];
    if (!item) return;
    const { node, offset } = ctx;
    const parent = node.parentNode;
    if (!parent) return;

    const after = node.splitText(offset);
    node.deleteData(s.start, node.length - s.start);

    insertSuggestionItem(item, s.kind, parent, after);
    opts.setSuggest(null);
    opts.syncFromDom();
  }

  return { applySuggestion, moveActiveSuggestion, setActiveSuggestion, updateSuggestions };
}
