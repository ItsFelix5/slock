import { errorMessage } from "@slock/core";
import { getHost, service } from "@slock/core/solid";
import { encodeReplyLink, withReplyLink } from "@slock/plugins/message-links/client/api/replyLink";
import type { PostedDraft } from "@slock/plugins/slack/client/api";
import { SLASH_COMMAND_RE } from "@slock/plugins/slash-commands/client/api";
import { broadcastRangeOf } from "@slock/slack";
import { blockPreviewText } from "@slock/slack/client";
import type { ChannelId, SlackFile, Ts } from "@slock/types";
import type { ComposerProps } from "./composerTypes";
import { uploadAll } from "./lib/attachUpload";
import { type DeltaOp, mrkdwnText } from "./lib/deltaLines";
import type { createPendingFileState } from "./lib/pendingFiles";
import { buildRichTextBlocks } from "./lib/richTextBuild";
import { submitComposerPayload } from "./lib/submission";

const feedback = service("feedback");

const composer = service("composer");

const messagesStore = service("messages");

const slashCommands = service("slash-commands");

interface SubmitEditor<Contents extends { ops: DeltaOp[] }> {
  getContents(): Contents;
  setContents(contents: Contents): unknown;
  setText(text: string): unknown;
}

export function createComposerSubmitHandler<Contents extends { ops: DeltaOp[] }>(deps: {
  channelId: () => ChannelId | undefined;
  clearDraftAfterSend: (postedDraftId?: string) => Promise<void>;
  discardDraft: (id: string) => Promise<void>;
  draft: () => PostedDraft | undefined;
  editing: () => ComposerProps["editing"];
  existingFiles: () => SlackFile[];
  feedbackKey: () => string;
  getQuill: () => SubmitEditor<Contents> | undefined;
  linkPreviews: {
    hasLinks: () => boolean;
    reset: () => unknown;
    urlsToSend: () => Promise<string[]>;
  };
  onSent: () => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  removedAttachmentIds: () => number[];
  replyTo: () => ComposerProps["replyTo"];
  sending: () => boolean;
  setExistingFiles: (files: SlackFile[]) => void;
  setSending: (sending: boolean) => void;
  threadTs: () => Ts | undefined;
}) {
  let submitting = false;

  async function handleSubmit() {
    if (!deps.channelId()) return;
    const quill = deps.getQuill();
    if (!quill) return;
    const rawText = mrkdwnText(quill.getContents().ops);
    const text = rawText.trim();
    const hasFiles = deps.pendingFiles.files().length > 0 || deps.existingFiles().length > 0;
    const editing = deps.editing();
    if (!(text || hasFiles || editing)) return;
    if (editing) {
      if (deps.sending()) return;
      deps.setSending(true);
      try {
        const blocks = buildRichTextBlocks(quill.getContents().ops);
        const newFiles = deps.pendingFiles.files();
        const existing = deps.existingFiles();
        const uploaded = await uploadAll(newFiles);
        const fileIds = [...existing, ...uploaded].map((f) => f.id);
        await editing.onSave(
          blockPreviewText(blocks) || text,
          blocks,
          fileIds,
          deps.removedAttachmentIds(),
        );
      } catch (err) {
        feedback.flash(deps.feedbackKey(), errorMessage(err, "Failed to save message."), "error");
      } finally {
        deps.setSending(false);
      }
      return;
    }
    if (submitting) return;
    submitting = true;
    try {
      await send(quill, rawText, text);
    } finally {
      submitting = false;
    }
  }

  async function send(quill: SubmitEditor<Contents>, rawText: string, text: string) {
    const channelId = deps.channelId();
    if (!channelId) return;
    const threadTs = deps.threadTs();
    const isSlashAttempt = SLASH_COMMAND_RE.test(rawText);
    const replyTo = deps.replyTo();
    const typedBlocks = isSlashAttempt ? undefined : buildRichTextBlocks(quill.getContents().ops);
    const blocks =
      typedBlocks && replyTo ? withReplyLink(typedBlocks, replyTo.permalink) : typedBlocks;
    const fallbackText = typedBlocks ? blockPreviewText(typedBlocks) || text : text;
    const outgoing =
      replyTo && !isSlashAttempt ? encodeReplyLink(replyTo.permalink) + fallbackText : fallbackText;
    const filesToSend = deps.pendingFiles.files();
    if (filesToSend.length > 0 && broadcastRangeOf({ blocks, text })) {
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
    const previewUrls = await deps.linkPreviews.urlsToSend();
    const unfurl = replyTo ? [...previewUrls, replyTo.permalink] : previewUrls;
    const uploadFirst = composer.uploadOnAttach() || deps.linkPreviews.hasLinks();
    const reusedFileIds = deps.existingFiles().map((f) => f.id);
    if (filesToSend.length > 0 && reusedFileIds.length > 0) {
      console.warn(
        "[composer] dropping reused template attachments: a freshly attached file was sent in the same message",
      );
    }
    const postsDraft =
      !(isSlashAttempt || broadcastRangeOf({ blocks, text })) &&
      (filesToSend.length === 0 || uploadFirst);
    const draft = postsDraft ? deps.draft() : undefined;
    const submittedContents = quill.getContents();
    const submittedExisting = deps.existingFiles();
    await submitComposerPayload({
      blocks,
      files: filesToSend,
      isSlashAttempt,
      onError: (err) => {
        if (draft) void deps.discardDraft(draft.id);
        if (!mrkdwnText(quill.getContents().ops).trim()) quill.setContents(submittedContents);
        if (deps.pendingFiles.files().length === 0) {
          deps.pendingFiles.add(filesToSend);
          deps.setExistingFiles(submittedExisting);
        }
        feedback.flash(deps.feedbackKey(), errorMessage(err, "Failed to send message."), "error");
      },
      onSuccess: () => {
        deps.linkPreviews.reset();
        quill.setText("\n");
        deps.setExistingFiles([]);
        void deps.clearDraftAfterSend(draft?.id);
        deps.onSent();
      },
      runCommand: () => slashCommands.handleSlashCommand(channelId, threadTs, text),
      sendMessage: () =>
        messagesStore.sendMessage(
          channelId,
          outgoing,
          unfurl,
          threadTs,
          blocks,
          filesToSend.length === 0 && reusedFileIds.length ? reusedFileIds : undefined,
          draft,
        ),
      uploadFiles: uploadFirst
        ? async () =>
            messagesStore.sendMessage(
              channelId,
              outgoing,
              unfurl,
              threadTs,
              blocks,
              (await uploadAll(filesToSend)).map((file) => file.id),
              draft,
            )
        : () => messagesStore.sendFiles(channelId, filesToSend, threadTs, outgoing),
    });
  }

  return handleSubmit;
}
