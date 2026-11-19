import type { Attachment, Block, Message, SlackFile } from "@slock/types";

export interface ComposerEditingProps {
  initialAttachments?: Attachment[];
  initialBlocks?: Block[];
  initialFiles?: SlackFile[];
  initialText?: string;
  onCancel: () => void;
  onSave: (
    text: string,
    blocks?: Block[],
    fileIds?: string[],
    removedAttachmentIds?: number[],
  ) => Promise<boolean>;
}

export interface ComposerReplyToProps {
  message?: Message;
  onCancel: () => void;
  onJump: () => void;
  onSent: () => void;
  permalink: string;
}

export interface ComposerProps {
  channelId: string;
  editing?: ComposerEditingProps;
  paneId?: string;
  placeholder?: string;
  replyTo?: ComposerReplyToProps;
  threadTs?: string;
}
