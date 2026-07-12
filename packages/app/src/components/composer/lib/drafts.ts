import { fetchDrafts, fetchSlashCommands, saveDraft } from "@slock/slack-api";
import { createSignal } from "solid-js";

// Drafts live on the real Slack account (drafts.list/create/delete) rather
// than in localStorage, so they follow you to another device the way a real
// unsent-message draft does. Keyed the same way as before (`thread:<ts>` for
// a thread reply, else the channel id) — this module-level cache is shared
// across every Composer instance (the component is reused across channel
// switches, never remounted), and is hydrated once from the account at load.
export const drafts: Record<string, string> = {};
export const [draftsReady, setDraftsReady] = createSignal(false);
fetchDrafts()
  .then((entries) => {
    for (const d of entries) drafts[d.threadTs ? `thread:${d.threadTs}` : d.channelId] = d.text;
  })
  .finally(() => setDraftsReady(true));

export const [slashCommandsGlobal, setSlashCommandsGlobal] = createSignal<
  { name: string; desc: string; icon: string | null }[]
>([]);
fetchSlashCommands()
  .then(setSlashCommandsGlobal)
  .catch(() => {});

const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Debounced so a debounce-free character-by-character sync doesn't spam
// drafts.create — Slack's own draft round-trip only needs to be roughly
// current, not live.
export function persistDraft(channelId: string, threadTs: string | undefined, text: string) {
  const key = threadTs ? `thread:${threadTs}` : channelId;
  const pending = draftSaveTimers.get(key);
  if (pending) clearTimeout(pending);
  draftSaveTimers.set(
    key,
    setTimeout(() => {
      draftSaveTimers.delete(key);
      saveDraft(channelId, threadTs, text).catch(() => {});
    }, 1000),
  );
}
