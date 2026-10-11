import { getHost, service } from "@slock/core/solid";
import { blockPreviewText, broadcastRangeFromBlocks } from "@slock/slack";
import type { SlackFile } from "@slock/types";
import type Quill from "quill";
import { encodeReplyLink } from "../../message-links/client/api/replyLink";
import { uploadFilesForEdit } from "../../slack/client/api";
import type { ComposerProps } from "./composerTypes";
import type { createPendingFileState } from "./lib/pendingFiles";
import { mrkdwnText } from "./lib/quillMentions";
import { blocksHaveProfileLink, buildRichTextBlocks, withReplyLink } from "./lib/richTextBuild";
import { submitComposerPayload } from "./lib/submission";

const feedback = service("feedback");

const messagesStore = service("messages");

const slashCommands = service("slash-commands");

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
        feedback.flash(
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
      feedback.flash(
        deps.feedbackKey(),
        "@channel can't be sent with a file. Send the file separately.",
        "error",
      );
      return;
    }
    for (const beforeSend of getHost().items("composer.beforeSend")) {
      const veto = await beforeSend({ blocks, channelId, files: filesToSend, text, threadTs });
      if (veto) {
        feedback.flash(deps.feedbackKey(), veto.cancel, "error");
        return;
      }
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
        feedback.flash(
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
      runCommand: () => slashCommands.handleSlashCommand(channelId, threadTs, text),
      sendMessage: () =>
        messagesStore.sendMessage(
          channelId,
          outgoing,
          threadTs,
          blocks,
          suppressUnfurl,
          filesToSend.length === 0 && reusedFileIds.length ? reusedFileIds : undefined,
        ),
      uploadFiles: () => messagesStore.sendFiles(channelId, filesToSend, threadTs, outgoing),
    });
  };
}
