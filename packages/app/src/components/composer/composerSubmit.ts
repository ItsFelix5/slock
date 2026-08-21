import type Quill from "quill";
import { uploadFiles } from "../../lib/api";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import { clearPersistedDraft, type createPendingFileState } from "./lib/drafts";
import { mrkdwnText } from "./lib/quillMentions";
import { submitComposerPayload } from "./lib/submission";

export function createComposerSubmitHandler(deps: {
  channelId: () => string | undefined;
  editing: () => ComposerProps["editing"];
  feedbackKey: () => string;
  getQuill: () => Quill | undefined;
  onSent: () => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  sending: () => boolean;
  setSending: (sending: boolean) => void;
  threadTs: () => string | undefined;
}) {
  return async function handleSubmit() {
    if (deps.sending() || !deps.channelId()) return;
    const quill = deps.getQuill();
    if (!quill) return;
    const text = mrkdwnText(quill).trim();
    if (!text && deps.pendingFiles.files().length === 0) return;
    deps.setSending(true);
    try {
      const editing = deps.editing();
      if (editing) {
        await editing.onSave(text);
        return;
      }
      const channelId = deps.channelId();
      if (!channelId) return;
      const threadTs = deps.threadTs();
      const isSlashAttempt = text.startsWith("/");
      await submitComposerPayload({
        files: deps.pendingFiles.files(),
        isSlashAttempt,
        onSuccess: () => {
          quill.setText("\n");
          clearPersistedDraft(channelId, threadTs, deps.pendingFiles);
          deps.onSent();
        },
        runCommand: () => store.commands.handleSlashCommand(channelId, threadTs, text),
        sendMessage: () => store.messages.sendMessage(channelId, text, threadTs),
        uploadFiles: () =>
          uploadFiles(
            channelId,
            deps.pendingFiles.files().map((file) => ({ file })),
            threadTs,
            text,
          ),
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
