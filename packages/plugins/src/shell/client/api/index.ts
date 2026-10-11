import type { Pane } from "@slock/ui";
import type { Accessor, Component, JSX } from "solid-js";
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

export type TitleResolver = (id: string) => { name: string; prefix?: string } | undefined;

export type DefaultView = () => PaneContent | undefined;

export type PaneResolver = (content: PaneContent) => PaneContent | undefined;

export type ShellBlocker = { active: () => boolean; view: Component };

declare module "@slock/core/types" {
  interface Points {
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
    "shell.layout": { startWidth: Accessor<number>; setStartWidth(width: number): void };
    "shell.panes": ReturnType<typeof createShellStore>["panes"];
    "shell.view": ReturnType<typeof createShellStore>["viewState"];
  }
}
