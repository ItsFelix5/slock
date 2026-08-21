import type { Block } from "../../lib/api";

export interface ComposerEditingProps {
  initialBlocks?: Block[];
  initialText?: string;
  onCancel: () => void;
  onSave: (text: string, blocks?: Block[]) => Promise<boolean>;
}

export interface ComposerReplyToProps {
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
