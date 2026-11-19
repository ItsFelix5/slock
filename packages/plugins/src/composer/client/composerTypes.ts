import type { Attachment, Block, ChannelId, Message, SlackFile, Ts } from "@slock/types";

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
  channelId: ChannelId;
  editing?: ComposerEditingProps;
  paneId?: string;
  placeholder?: string;
  replyTo?: ComposerReplyToProps;
  threadTs?: Ts;
}
