import type { Block } from "@slock/types";
import type { useHoverIntent } from "@slock/ui";
import type { Component } from "solid-js";
import type { ComposerProps } from "./composerTypes";
import type { MentionValue } from "./lib/quillMentions";

export type { ComposerProps } from "./composerTypes";

export type ComposerAttachProps = {
  close(): void;
  insertDate(): void;
  pickFiles(): void;
};

export type ExtraSuggestion = {
  id: string;
  label: string;
  description?: string;
  insert: string;
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

declare module "@slock/core/types" {
  interface Points {
    "composer.attach": Component<ComposerAttachProps>;
    "composer.beforeSend": BeforeSend;
    "composer.input": Component<ComposerProps>;
    "composer.notice": Component<ComposerProps>;
    "composer.mentionCard": Component<MentionCardProps>;
    "composer.suggest": ComposerSuggest;
  }
}
