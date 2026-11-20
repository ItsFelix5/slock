import type { ChannelId } from "@slock/types";
import type { ConfirmDialogState, Pane, PaneLayoutProps } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import type { Accessor, Component } from "solid-js";
import type { createFeedback } from "../feedback";
import type { createShellStore } from "../store";
import type { createTitles } from "../titles";
import type { PaneContent } from "./types";

export type PaneKind = {
  kind: string;
  followsFocus?: boolean;
  primary?: boolean;
  identity?(content: PaneContent): unknown;
  singleton?: boolean | ((content: PaneContent) => boolean);
  size?: number;
  url?: {
    parse(segment: string): PaneContent | null;
    serialize(content: PaneContent): string;
  };
  view(props: { pane: Pane<PaneContent | null> }): JSX.Element;
  tabLabel(content: PaneContent): JSX.Element;
};

export type TitleResolver = (id: ChannelId) => { name: string; prefix?: string } | undefined;

export type DefaultView = () => PaneContent | undefined;

export type PaneResolver = (content: PaneContent) => PaneContent | undefined;

export type ShellBlocker = { active: () => boolean; view: Component };

export type ShellArrangement = { view: Component<PaneLayoutProps<PaneContent | null>> };

declare module "@slock/core/types" {
  interface Points {
    "shell.arrangement": ShellArrangement;
    "shell.blocker": ShellBlocker;
    "shell.default": DefaultView;
    "shell.overlay": Component;
    "shell.pane": PaneKind;
    "shell.provider": Component<{ children: JSX.Element }>;
    "shell.ready": () => boolean;
    "shell.resolve": PaneResolver;
    "shell.start": Component;
    "shell.title": TitleResolver;
  }
  interface Services {
    feedback: ReturnType<typeof createFeedback>;
    titles: ReturnType<typeof createTitles>;
    "shell.dialogs": ConfirmDialogState;
    "shell.layout": {
      startWidth: Accessor<number>;
      setStartWidth(width: number): void;
      windowWidth: Accessor<number>;
    };
    "shell.panes": ReturnType<typeof createShellStore>["panes"];
    "shell.view": ReturnType<typeof createShellStore>["viewState"];
  }
}
