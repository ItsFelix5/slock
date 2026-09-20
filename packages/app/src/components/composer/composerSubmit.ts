import type Quill from "quill";
import { blockPreviewText, uploadFiles } from "../../lib/api";
import { actionFeedback } from "../../lib/feedback";
import { encodeReplyLink } from "../../lib/replyLink";
import { store } from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import { clearPersistedDraft, type createPendingFileState } from "./lib/drafts";
import { mrkdwnText } from "./lib/quillMentions";
import { blocksHaveProfileLink, buildRichTextBlocks } from "./lib/richTextBuild";
import { submitComposerPayload } from "./lib/submission";

export function createComposerSubmitHandler(deps: {
  channelId: () => string | undefined;
  editing: () => ComposerProps["editing"];
  feedbackKey: () => string;
  getQuill: () => Quill | undefined;
  onSent: () => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  replyTo: () => ComposerProps["replyTo"];
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
        const blocks = buildRichTextBlocks(quill);
        await editing.onSave(blockPreviewText(blocks) || text, blocks);
        return;
      }
      const channelId = deps.channelId();
      if (!channelId) return;
      const threadTs = deps.threadTs();
      const isSlashAttempt = text.startsWith("/");
      const replyTo = deps.replyTo();
      const blocks = isSlashAttempt ? undefined : buildRichTextBlocks(quill);
      const suppressUnfurl = !!blocks && blocksHaveProfileLink(blocks);
      const fallbackText = blocks ? blockPreviewText(blocks) || text : text;
      const outgoing =
        replyTo && !isSlashAttempt
          ? encodeReplyLink(replyTo.permalink) + fallbackText
          : fallbackText;
      await submitComposerPayload({
        blocks,
        files: deps.pendingFiles.files(),
        isSlashAttempt,
        onSuccess: () => {
          quill.setText("\n");
          clearPersistedDraft(channelId, threadTs, deps.pendingFiles);
          deps.onSent();
        },
        runCommand: () => store.commands.handleSlashCommand(channelId, threadTs, text),
        sendMessage: () =>
          store.messages.sendMessage(channelId, outgoing, threadTs, blocks, suppressUnfurl),
        uploadFiles: () =>
          uploadFiles(
            channelId,
            deps.pendingFiles.files().map((file) => ({ file })),
            threadTs,
            outgoing,
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
