import { blockPreviewText, broadcastRangeFromBlocks, type SlackFile } from "@slock/types";
import type Quill from "quill";
import { uploadFilesForEdit } from "../../lib/api";
import { actionFeedback } from "../../lib/feedback";
import { encodeReplyLink } from "../../lib/replyLink";
import { store } from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import type { createPendingFileState } from "./lib/drafts";
import { mrkdwnText } from "./lib/quillMentions";
import { blocksHaveProfileLink, buildRichTextBlocks, withReplyLink } from "./lib/richTextBuild";
import { submitComposerPayload } from "./lib/submission";

export function createComposerSubmitHandler(deps: {
  channelId: () => string | undefined;
  clearDraftAfterSend: () => Promise<void>;
  editing: () => ComposerProps["editing"];
  existingFiles: () => SlackFile[];
  feedbackKey: () => string;
  getQuill: () => Quill | undefined;
  onSent: () => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  replyTo: () => ComposerProps["replyTo"];
  sending: () => boolean;
  setExistingFiles: (files: SlackFile[]) => void;
  setSending: (sending: boolean) => void;
  threadTs: () => string | undefined;
}) {
  return async function handleSubmit() {
    if (!deps.channelId()) return;
    const quill = deps.getQuill();
    if (!quill) return;
    const text = mrkdwnText(quill).trim();
    const hasFiles = deps.pendingFiles.files().length > 0 || deps.existingFiles().length > 0;
    if (!(text || hasFiles)) return;
    const editing = deps.editing();
    if (editing) {
      if (deps.sending()) return;
      deps.setSending(true);
      try {
        const blocks = buildRichTextBlocks(quill);
        const newFiles = deps.pendingFiles.files();
        const existing = deps.existingFiles();
        const uploaded = newFiles.length
          ? await uploadFilesForEdit(newFiles.map((file) => ({ file })))
          : [];
        const fileIds = [...existing, ...uploaded].map((f) => f.id);
        await editing.onSave(blockPreviewText(blocks) || text, blocks, fileIds);
      } catch (err) {
        actionFeedback.flash(
          deps.feedbackKey(),
          err instanceof Error ? err.message : "Failed to save message.",
          "error",
        );
      } finally {
        deps.setSending(false);
      }
      return;
    }
    const channelId = deps.channelId();
    if (!channelId) return;
    const threadTs = deps.threadTs();
    const isSlashAttempt = text.startsWith("/");
    const replyTo = deps.replyTo();
    const typedBlocks = isSlashAttempt ? undefined : buildRichTextBlocks(quill);
    const blocks =
      typedBlocks && replyTo ? withReplyLink(typedBlocks, replyTo.permalink) : typedBlocks;
    const suppressUnfurl = !!blocks && blocksHaveProfileLink(blocks);
    const fallbackText = typedBlocks ? blockPreviewText(typedBlocks) || text : text;
    const outgoing =
      replyTo && !isSlashAttempt ? encodeReplyLink(replyTo.permalink) + fallbackText : fallbackText;
    const filesToSend = deps.pendingFiles.files();
    if (filesToSend.length > 0 && broadcastRangeFromBlocks(blocks)) {
      actionFeedback.flash(
        deps.feedbackKey(),
        "@channel can't be sent with a file. Send the file separately.",
        "error",
      );
      return;
    }
    const reusedFileIds = deps.existingFiles().map((f) => f.id);
    if (filesToSend.length > 0 && reusedFileIds.length > 0) {
      console.warn(
        "[composer] dropping reused template attachments: a freshly attached file was sent in the same message",
      );
    }
    const submittedContents = quill.getContents();
    const submittedExisting = deps.existingFiles();
    await submitComposerPayload({
      blocks,
      files: filesToSend,
      isSlashAttempt,
      onError: (err) => {
        if (!mrkdwnText(quill).trim()) quill.setContents(submittedContents);
        if (deps.pendingFiles.files().length === 0) {
          deps.pendingFiles.add(filesToSend);
          deps.setExistingFiles(submittedExisting);
        }
        actionFeedback.flash(
          deps.feedbackKey(),
          err instanceof Error ? err.message : "Failed to send message.",
          "error",
        );
      },
      onSuccess: () => {
        quill.setText("\n");
        deps.setExistingFiles([]);
        void deps.clearDraftAfterSend();
        deps.onSent();
      },
      runCommand: () => store.commands.handleSlashCommand(channelId, threadTs, text),
      sendMessage: () =>
        store.messages.sendMessage(
          channelId,
          outgoing,
          threadTs,
          blocks,
          suppressUnfurl,
          filesToSend.length === 0 && reusedFileIds.length ? reusedFileIds : undefined,
        ),
      uploadFiles: () => store.messages.sendFiles(channelId, filesToSend, threadTs, outgoing),
    });
  };
}
