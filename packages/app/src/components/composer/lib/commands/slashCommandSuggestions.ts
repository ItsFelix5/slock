import { fetchSlashCommands } from "@slock/slack-api";
import { createSignal } from "solid-js";

export const [slashCommandsGlobal, setSlashCommandsGlobal] = createSignal<
  { name: string; desc: string; icon: string | null }[]
>([]);
export const [slashCommandsLoading, setSlashCommandsLoading] = createSignal(false);
export const [slashCommandsLoadError, setSlashCommandsLoadError] = createSignal(false);

let loaded = false;
let loadPromise: Promise<void> | null = null;

export function loadSlashCommandSuggestions(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  setSlashCommandsLoading(true);
  setSlashCommandsLoadError(false);
  const request = fetchSlashCommands()
    .then((commands) => {
      setSlashCommandsGlobal(commands);
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

void loadSlashCommandSuggestions();

export function createSlashCommandSuggestionState(text: () => string) {
  const isSlashCommandDraft = () => text().trimStart().startsWith("/");
  return {
    retrySlashCommandSuggestions: loadSlashCommandSuggestions,
    slashCommandSuggestionsError: () => isSlashCommandDraft() && slashCommandsLoadError(),
    slashCommandSuggestionsLoading: () => isSlashCommandDraft() && slashCommandsLoading(),
  };
}
