import type { Block, Message, SlackFile } from "@slock/types";

export interface ComposerEditingProps {
  initialBlocks?: Block[];
  initialFiles?: SlackFile[];
  initialText?: string;
  onCancel: () => void;
  onSave: (text: string, blocks?: Block[], fileIds?: string[]) => Promise<boolean>;
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
