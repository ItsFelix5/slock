import { getHost, service } from "@slock/core/solid";
import { listNavigationIndex } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import type { ExtraSuggestion } from "../../api";
import {
  createStaticSuggestion,
  type SuggestionOptions,
  templateSuggestion,
  updateChannelSuggestions,
  updateUserSuggestions,
} from "../../lib/suggestionSources";
import { detectMentionTrigger } from "../../lib/textDetection";
import type { CustomSuggestItem, SuggestState } from "./suggestTypes";

const slashCommands = service("slash-commands");
const emojiIndex = service("emoji");

export function suggestionText(item: SuggestState["items"][number]): string {
  if (item.kind === "custom") return `${item.insert} `;
  if (item.kind === "command") return `/${item.name} `;
  if (item.kind === "emoji") return `:${item.name}: `;
  if (item.kind === "user") return `<@${item.id}> `;
  return `<#${item.id}|${item.name}> `;
}

function customItem(entry: ExtraSuggestion): CustomSuggestItem {
  const { alternate, description, id, insert, label } = entry;
  return {
    alternate: alternate && customItem(alternate),
    description,
    id,
    insert,
    kind: "custom",
    name: label,
  };
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

  function toggleAlternate(): boolean {
    const s = opts.suggest();
    if (s?.kind !== "custom") return false;
    const item = s.items[s.active];
    if (!item?.alternate) return false;
    const { alternate, ...current } = item;
    const swapped: CustomSuggestItem = { ...alternate, alternate: current };
    opts.setSuggest({
      ...s,
      items: s.items.map((entry, index) => (index === s.active ? swapped : entry)),
    });
    return true;
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
      const { kind, start } = trigger;
      const staticSuggestion = () => createStaticSuggestion(kind, start, q, opts.lineCommands?.());
      if (kind === "command" && !opts.lineCommands)
        void slashCommands.load().then(() => {
          if (reqId === suggestRequestId) opts.setSuggest(staticSuggestion());
        });
      if (kind === "emoji") void emojiIndex.source.load();
      opts.setSuggest(staticSuggestion());
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
              items: found.map(customItem),
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
    toggleAlternate,
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
