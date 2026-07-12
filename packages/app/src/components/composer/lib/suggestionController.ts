import { emojiUrl } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { fuzzySearch } from "@slock/ui";
import type { Setter } from "solid-js";
import { allEmojiEntries, frequentEmoji, searchEmoji } from "../../../lib/emojiSearch";
import { channels, currentUser, frecencyScore, knownUsers, searchUsers } from "../../../lib/store";
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

// Drives the @mention / #channel / :emoji: / slash-command popover: matching
// the in-progress trigger to ranked candidates, keyboard/mouse selection
// within the list, and splicing the chosen item into the DOM at the caret.
export function createSuggestionController(opts: {
  suggest: () => SuggestState | null;
  setSuggest: Setter<SuggestState | null>;
  currentTextContext: () => { node: Text; offset: number } | null;
  syncFromDom: () => void;
}) {
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

    if (trigger.kind === "command") {
      const items = fuzzySearch(slashCommandsGlobal(), { query: q, text: (c) => c.name }).map(
        (c): CommandSuggestItem => ({ kind: "command", name: c.name, desc: c.desc, icon: c.icon }),
      );
      opts.setSuggest(
        items.length > 0 ? { kind: "command", start: trigger.start, items, active: 0 } : null,
      );
      return;
    }

    if (trigger.kind === "emoji") {
      const entries = allEmojiEntries();
      const ranked = q ? searchEmoji(entries, q) : frequentEmoji(entries, 8);
      const items: EmojiSuggestItem[] = ranked
        .slice(0, 8)
        .map((e) => ({ kind: "emoji", name: e.name, unicode: e.unicode }));
      opts.setSuggest(
        items.length > 0 ? { kind: "emoji", start: trigger.start, items, active: 0 } : null,
      );
      return;
    }

    // Both branches below rank by fuzzy name match first, frecency (usage
    // frequency/recency) as the tiebreaker — same policy as GlobalSearch and
    // the emoji picker — and re-rank the *whole* candidate pool (local +
    // remote) each time new remote results land, so a remote match doesn't
    // just get appended after whatever was locally visible first.

    if (trigger.kind === "user" || trigger.kind === "userlink") {
      const stateKind = trigger.kind;
      const me = currentUser()?.id;
      const toItems = (users: User[]): UserSuggestItem[] =>
        fuzzySearch(users, { query: q, text: (u) => u.name, frequency: (u) => frecencyScore(u.id) })
          .slice(0, 8)
          .map((u) => ({ kind: "user", id: u.id, name: u.name, user: u }));

      const localUsers = knownUsers().filter((u) => u.id !== me);
      opts.setSuggest({
        kind: stateKind,
        start: trigger.start,
        items: toItems(localUsers),
        active: 0,
      });
      if (!q) return;
      searchUsers(q, me).then((found) => {
        if (reqId !== suggestRequestId) return;
        const merged = new Map<string, User>();
        for (const u of localUsers) merged.set(u.id, u);
        for (const u of found) merged.set(u.id, u);
        opts.setSuggest((prev) =>
          prev?.kind === stateKind ? { ...prev, items: toItems([...merged.values()]) } : prev,
        );
      });
      return;
    }

    type ChannelCandidate = { id: string; name: string; private: boolean };
    const toChannelItems = (list: ChannelCandidate[]): ChannelSuggestItem[] =>
      fuzzySearch(list, { query: q, text: (c) => c.name, frequency: (c) => frecencyScore(c.id) })
        .slice(0, 8)
        .map((c) => ({ kind: "channel", id: c.id, name: c.name, private: c.private }));

    const localChannels = channels();
    opts.setSuggest({
      kind: "channel",
      start: trigger.start,
      items: toChannelItems(localChannels),
      active: 0,
    });
    if (!q) return;
    fetchBrowsableChannels(q).then((found) => {
      if (reqId !== suggestRequestId) return;
      const merged = new Map<string, ChannelCandidate>();
      for (const c of localChannels) merged.set(c.id, c);
      for (const c of found) merged.set(c.id, c);
      opts.setSuggest((prev) =>
        prev?.kind === "channel" ? { ...prev, items: toChannelItems([...merged.values()]) } : prev,
      );
    });
  }

  function applySuggestion(index?: number) {
    const s = opts.suggest();
    const ctx = opts.currentTextContext();
    if (!s || !ctx) return;
    const item = s.items[index ?? s.active];
    if (!item) return;
    const { node, offset } = ctx;
    const parent = node.parentNode;
    if (!parent) return;

    const after = node.splitText(offset);
    node.deleteData(s.start, node.length - s.start);

    if (item.kind === "command") {
      const insertion = document.createTextNode(`/${item.name} `);
      parent.insertBefore(insertion, after);
      placeCaretInText(insertion, insertion.length);
    } else if (item.kind === "emoji") {
      if (emojiUrl(item.name)) {
        const chip = createEmojiChip(item.name);
        parent.insertBefore(chip, after);
        const space = document.createTextNode(" ");
        parent.insertBefore(space, after);
        placeCaretInText(space, 1);
      } else {
        const insertion = document.createTextNode(`${item.unicode ?? `:${item.name}:`} `);
        parent.insertBefore(insertion, after);
        placeCaretInText(insertion, insertion.length);
      }
    } else {
      const chip =
        s.kind === "userlink"
          ? createUserLinkChip(item.id, item.name)
          : item.kind === "user"
            ? createMentionChip(item.id, item.name)
            : createChannelChip(item.id, item.name);
      parent.insertBefore(chip, after);
      const space = document.createTextNode(" ");
      parent.insertBefore(space, after);
      placeCaretInText(space, 1);
    }
    opts.setSuggest(null);
    opts.syncFromDom();
  }

  return { setActiveSuggestion, moveActiveSuggestion, updateSuggestions, applySuggestion };
}
