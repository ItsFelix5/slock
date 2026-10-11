import { loadCustomEmoji } from "@slock/blockkit";
import { getHost } from "@slock/core/solid";
import { listNavigationIndex } from "@slock/ui";
import type Quill from "quill";
import type { ExtraSuggestion } from "../../api";
import { loadSlashCommandSuggestions } from "../../lib/commands/slashCommandSuggestions";
import {
  createStaticSuggestion,
  type SuggestionOptions,
  templateSuggestion,
  updateChannelSuggestions,
  updateUserSuggestions,
} from "../../lib/suggestionSources";
import { detectMentionTrigger } from "../../lib/textDetection";
import type { SuggestState } from "./suggestTypes";

export function suggestionText(item: SuggestState["items"][number]): string {
  if (item.kind === "custom") return `${item.insert} `;
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

  function updateSuggestions(value: string, cursor: number, isDocStart = true, plainText = false) {
    const extra = getHost().items("composer.suggest");
    const trigger = detectMentionTrigger(
      value,
      cursor,
      !!opts.lineCommands,
      extra.map((item) => item.trigger),
    );
    if (!trigger) {
      opts.setSuggest(null);
      return;
    }
    const blockedInPlainText = plainText && trigger.kind !== "emoji";
    const blockedCommand =
      trigger.kind === "command" && (opts.includeCommands === false || !isDocStart);
    if (blockedInPlainText || blockedCommand) {
      opts.setSuggest(null);
      return;
    }
    const q = trigger.query.toLowerCase();
    const reqId = ++suggestRequestId;
    if (trigger.kind === "command" || trigger.kind === "emoji") {
      if (trigger.kind === "command" && !opts.lineCommands) void loadSlashCommandSuggestions();
      if (trigger.kind === "emoji") void loadCustomEmoji();
      opts.setSuggest(
        createStaticSuggestion(trigger.kind, trigger.start, q, opts.lineCommands?.()),
      );
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
    if (trigger.kind === "custom") {
      const source = extra.find((item) => item.trigger === trigger.trigger);
      if (!source) return;
      const toState = (found: ExtraSuggestion[]): SuggestState | null =>
        found.length > 0
          ? {
              active: 0,
              items: found.map((entry) => ({
                description: entry.description,
                id: entry.id,
                insert: entry.insert,
                kind: "custom" as const,
                name: entry.label,
              })),
              kind: "custom",
              start: trigger.start,
            }
          : null;
      void Promise.resolve(source.search(q)).then((found) => {
        if (reqId === suggestRequestId) opts.setSuggest(toState(found));
      });
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
  plainTextHeaders = false,
) {
  queueMicrotask(() => {
    const caretIndex = quill.getSelection()?.index ?? text.length;
    setCaretIndex(caretIndex);
    const format = quill.getFormat(caretIndex);
    const plainText = plainTextHeaders && !!(format.header || format.context);
    controller.updateSuggestions(text, caretIndex, true, plainText);
  });
}
