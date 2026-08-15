import {
  ATOM_DATE,
  ATOM_EMOJI,
  ATOM_MENTION,
  type ComposeAtomData,
  formatSlackDateTokens,
} from "@slock/blockkit";
import { createAtomRun, createTextRun, type EditorHandle } from "@slock/ui";
import type { SuggestItem, SuggestState } from "./lib/suggestTypes";

/** Turns a picked suggestion (slash command, emoji, user or channel mention) into the atom/text
 * runs that get spliced into the editor at the trigger's position. */
export function applyTextSuggestion(
  editor: EditorHandle<ComposeAtomData>,
  item: SuggestItem,
  state: SuggestState,
) {
  if (item.kind === "command") {
    editor.replaceTriggerRange(state.start, createTextRun(`/${item.name} `));
    return;
  }
  if (item.kind === "emoji") {
    editor.replaceTriggerRange(state.start, [
      createAtomRun(ATOM_EMOJI, {
        fallbackText: `:${item.name}:`,
        name: item.name,
        unicode: item.unicode,
      }),
      createTextRun(" "),
    ]);
    return;
  }
  if (item.kind === "user") {
    editor.replaceTriggerRange(state.start, [
      createAtomRun(ATOM_MENTION, {
        fallbackText: `<@${item.id}>`,
        refId: item.id,
        target: "user",
      }),
      createTextRun(" "),
    ]);
    return;
  }
  editor.replaceTriggerRange(state.start, [
    createAtomRun(ATOM_MENTION, {
      fallbackText: `<#${item.id}>`,
      refId: item.id,
      target: "channel",
    }),
    createTextRun(" "),
  ]);
}

export function insertDateAtom(
  editor: EditorHandle<ComposeAtomData>,
  timestamp: number,
  format: string,
) {
  editor.insertAtomAtCaret(ATOM_DATE, {
    fallbackText: formatSlackDateTokens(format, timestamp),
    format,
    timestamp,
  });
  editor.focus();
}
