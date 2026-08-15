import { type ComposeAtomData, docToBlocks } from "@slock/blockkit";
import { uploadFiles } from "@slock/slack-api";
import type { EditorHandle } from "@slock/ui";
import { actionFeedback, store } from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import { clearPersistedDraft } from "./lib/drafts";
import {
  type createPendingFileState,
  draftCacheKey,
  submitComposerPayload,
} from "./lib/submission";

/** Send-on-submit for the composer: routes to editing.onSave when editing an existing message,
 * otherwise runs a slash command or uploads/sends a new one - clearing the editor, draft, and
 * pending files on success either way. */
export function createComposerSubmitHandler(deps: {
  channelId: () => string | undefined;
  editing: () => ComposerProps["editing"];
  editor: EditorHandle<ComposeAtomData>;
  feedbackKey: () => string;
  onSent: () => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  sending: () => boolean;
  setSending: (sending: boolean) => void;
  threadTs: () => string | undefined;
}) {
  return async function handleSubmit() {
    if (deps.sending() || !deps.channelId()) return;
    const text = deps.editor.getPlainText().trim();
    if (!text && deps.pendingFiles.files().length === 0 && deps.editor.isEmpty()) return;
    deps.setSending(true);
    try {
      const editing = deps.editing();
      if (editing) {
        const blocks = deps.editor.isEmpty() ? undefined : docToBlocks(deps.editor.getDoc());
        const ok = await editing.onSave(text, blocks);
        if (!ok) return;
        return;
      }
      const channelId = deps.channelId();
      if (!channelId) return;
      const threadTs = deps.threadTs();
      const isSlashAttempt = text.startsWith("/");
      const blocks =
        isSlashAttempt || deps.editor.isEmpty() ? undefined : docToBlocks(deps.editor.getDoc());
      const key = draftCacheKey(channelId, threadTs);
      await submitComposerPayload({
        blocks,
        files: deps.pendingFiles.files(),
        isSlashAttempt,
        onSuccess: () => {
          deps.editor.clear();
          deps.pendingFiles.clear(key);
          clearPersistedDraft(channelId, threadTs);
          deps.onSent();
        },
        runCommand: () => store.commands.handleSlashCommand(channelId, threadTs, text),
        sendMessage: (b) => store.messages.sendMessage(channelId, text, threadTs, b),
        uploadFiles: () => uploadFiles(channelId, deps.pendingFiles.files(), threadTs, text),
      });
    } catch (err) {
      actionFeedback.flash(
        deps.feedbackKey(),
        err instanceof Error ? err.message : "Failed to send message.",
        "error",
      );
    } finally {
      deps.setSending(false);
    }
  };
}
