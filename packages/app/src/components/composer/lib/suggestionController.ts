import { loadCustomEmoji } from "@slock/blockkit";
import { listNavigationIndex } from "@slock/ui";
import type Quill from "quill";
import { loadSlashCommandSuggestions } from "./commands/slashCommandSuggestions";
import {
  createStaticSuggestion,
  type SuggestionOptions,
  templateSuggestion,
  updateChannelSuggestions,
  updateUserSuggestions,
} from "./suggestionSources";
import type { SuggestState } from "./suggestTypes";
import { detectMentionTrigger } from "./textDetection";

export function suggestionText(item: SuggestState["items"][number]): string {
  if (item.kind === "command") return `/${item.name} `;
  if (item.kind === "emoji") return `:${item.name}: `;
  if (item.kind === "user") return `<@${item.id}> `;
  return `<#${item.id}|${item.name}> `;
}

export function createSuggestionController(opts: SuggestionOptions) {
  let suggestRequestId = 0;

  function setActiveSuggestion(index: number) {
    opts.setSuggest((prev) => (prev ? { ...prev, active: index } : prev));
  }

  function moveActiveSuggestion(delta: number) {
    const s = opts.suggest();
    if (!s) return;
    const next = listNavigationIndex(delta > 0 ? "down" : "up", s.active, s.items.length, {
      wrap: true,
    });
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
    if (trigger.kind === "template") {
      opts.setSuggest(templateSuggestion(trigger.start, q));
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

export function syncSuggestionsAfterChange(
  quill: Quill,
  text: string,
  controller: ReturnType<typeof createSuggestionController>,
  setCaretIndex: (index: number) => void,
) {
  queueMicrotask(() => {
    const caretIndex = quill.getSelection()?.index ?? text.length;
    setCaretIndex(caretIndex);
    controller.updateSuggestions(text, caretIndex);
  });
}
