import { apiGet } from "@slock/slack";
import { createSignal } from "solid-js";
import type { CommandSuggestItem } from "../../api/editor/suggestTypes";

export const [slashCommandsGlobal, setSlashCommandsGlobal] = createSignal<CommandSuggestItem[]>([]);
export const [slashCommandsLoading, setSlashCommandsLoading] = createSignal(false);
export const [slashCommandsLoadError, setSlashCommandsLoadError] = createSignal(false);

async function fetchSlashCommands() {
  const data = await apiGet<{ commands?: { desc: string; icon: string | null; name: string }[] }>(
    "/api/commands",
  );
  if (!data.ok) throw new Error(data.error ?? "fetching commands failed");
  return data.commands ?? [];
}

let loaded = false;
let loadPromise: Promise<void> | null = null;

export function resetSlashCommandSuggestions() {
  loaded = false;
  loadPromise = null;
  setSlashCommandsGlobal([]);
  setSlashCommandsLoading(false);
  setSlashCommandsLoadError(false);
}

export function loadSlashCommandSuggestions(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  setSlashCommandsLoading(true);
  setSlashCommandsLoadError(false);
  const request = fetchSlashCommands()
    .then((commands) => {
      setSlashCommandsGlobal(commands.map((c) => ({ ...c, kind: "command" })));
      loaded = true;
    })
    .catch(() => {
      setSlashCommandsLoadError(true);
    })
    .finally(() => {
      setSlashCommandsLoading(false);
      if (loadPromise === request) loadPromise = null;
    });
  loadPromise = request;
  return request;
}

export function invalidateSlashCommandSuggestions(): void {
  loaded = false;
  loadPromise = null;
}

export function createSlashCommandSuggestionState(text: () => string) {
  const isSlashCommandDraft = () => text().trimStart().startsWith("/");
  return {
    retrySlashCommandSuggestions: loadSlashCommandSuggestions,
    slashCommandSuggestionsError: () => isSlashCommandDraft() && slashCommandsLoadError(),
    slashCommandSuggestionsLoading: () => isSlashCommandDraft() && slashCommandsLoading(),
  };
}
