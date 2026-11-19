import type { Block, SlackFile } from "@slock/types";
import type { IconName, useHoverIntent } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import type { Component } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { ComposerProps } from "./composerTypes";
import type { MentionValue } from "./lib/embedValues";

export type { ComposerProps } from "./composerTypes";

export type ComposerEditor = {
  props?: ComposerProps;
  quill(): Quill | undefined;
  showPopover(render: (close: () => void) => JSX.Element): void;
};

export type ComposerTrailingProps = ComposerProps & { text: string };

export type ComposerAttachProps = ComposerEditor & {
  addFiles(files: File[]): void;
  close(): void;
  pickFiles(): void;
};

export type BindEditor = (quill: Quill, editor: ComposerEditor) => (() => void) | undefined;

export { type DateValue, dateValue } from "./lib/embedValues";

export type ExtraSuggestion = {
  id: string;
  label: string;
  description?: string;
  insert: string;
  alternate?: Omit<ExtraSuggestion, "alternate">;
};

export type ComposerSuggest = {
  trigger: string;
  search(query: string): ExtraSuggestion[] | Promise<ExtraSuggestion[]>;
};

export type MentionCardProps = {
  anchor: () => HTMLElement | undefined;
  hoverIntent: ReturnType<typeof useHoverIntent>;
  id: string;
  kind: MentionValue["kind"];
};

export type OutgoingDraft = {
  channelId: string;
  threadTs?: string;
  text: string;
  blocks?: Block[];
  files: File[];
};

export type BeforeSend = (
  draft: OutgoingDraft,
) => { cancel: string } | undefined | Promise<{ cancel: string } | undefined>;

export type DraftContent = {
  blocks: Block[];
  files: SlackFile[];
};

export type ComposerDraftAction = {
  icon: IconName;
  label: string;
  namePlaceholder: string;
  save(name: string, draft: DraftContent): void;
};

declare module "@slock/core/types" {
  interface Services {
    composer: { uploadOnAttach: () => boolean };
  }
  interface Points {
    "composer.attach": Component<ComposerAttachProps>;
    "composer.beforeSend": BeforeSend;
    "composer.draftAction": ComposerDraftAction;
    "composer.editor": BindEditor;
    "composer.input": Component<ComposerProps>;
    "composer.notice": Component<ComposerProps>;
    "composer.mentionCard": Component<MentionCardProps>;
    "composer.suggest": ComposerSuggest;
    "composer.trailing": Component<ComposerTrailingProps>;
  }
}
