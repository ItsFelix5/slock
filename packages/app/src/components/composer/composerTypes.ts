export type ComposerProps = {
  channelId?: string;
  threadTs?: string;
  placeholder?: string;
  replyTo?: { permalink: string; onSent: () => void };
  editing?: {
    initialText: string;
    initialBlocks?: unknown;
    onSave: (text: string, blocks?: unknown) => Promise<boolean>;
    onCancel: () => void;
  };
};
